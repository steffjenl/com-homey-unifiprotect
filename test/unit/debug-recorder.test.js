'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const DebugRecorder = require('../../library/debug-recorder');
const ProtectWebSocket = require('../../library/protect-api-v2/web-socket-events');
const { createWebSocketHarness } = require('../mocks/fake-v2-websocket');

const { redact } = DebugRecorder;

function createHomey(settings = {}) {
  const store = { ...settings };
  const timers = [];
  return {
    store,
    timers,
    settings: {
      get: (key) => store[key],
      set: (key, value) => {
        store[key] = value;
      },
    },
    setTimeout: (fn, ms) => {
      const timer = { fn, ms, cleared: false };
      timers.push(timer);
      return timer;
    },
    clearTimeout: (timer) => {
      if (timer) timer.cleared = true;
    },
    error: jest.fn(),
    manifest: { id: 'com.ubnt.unifiprotect', version: '9.9.9' },
    version: '12.0.0',
    app: {
      debug: jest.fn(),
      isV1Available: () => false,
      isV2Available: () => false,
      getConnectionStatus: () => ({ v1: { configured: false } }),
    },
    drivers: { getDrivers: () => ({}) },
  };
}

function readLines(file) {
  return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
}

describe('redact', () => {
  test('removes secrets', () => {
    const out = redact({
      apiKey: 'abc', accessToken: 'x', password: 'p', nested: { csrfToken: 'c', rtspAlias: 'r' }, modelKey: 'camera',
    }, 'salt');
    expect(out).toEqual({
      apiKey: '<removed>',
      accessToken: '<removed>',
      password: '<removed>',
      nested: { csrfToken: '<removed>', rtspAlias: '<removed>' },
      modelKey: 'camera',
    });
  });

  test('hashes PII keys with a stable value per salt', () => {
    const a = redact({ mac: 'AABBCCDDEEFF', host: '192.168.1.10', email: 'me@example.com' }, 's1');
    const b = redact({ mac: 'AABBCCDDEEFF' }, 's1');
    const c = redact({ mac: 'AABBCCDDEEFF' }, 's2');
    expect(a.mac).toMatch(/^<redacted:[0-9a-f]{8}>$/);
    expect(a.host).toMatch(/^<redacted:/);
    expect(a.email).toMatch(/^<redacted:/);
    expect(a.mac).toBe(b.mac);
    expect(a.mac).not.toBe(c.mac);
  });

  test('hashes values nested under a PII key and user names', () => {
    const out = redact({ nfc: { id: '1234', enabled: true }, users: [{ name: 'Jan', id: 'u1' }] }, 's');
    expect(out.nfc.id).toMatch(/^<redacted:/);
    expect(out.nfc.enabled).toBe(true);
    expect(out.users[0].name).toMatch(/^<redacted:/);
    expect(out.users[0].id).toBe('u1');
  });

  test('masks IPs, MACs and e-mails inside free text but keeps version strings', () => {
    const out = redact({
      url: 'rtsps://10.0.0.5:7441/x', note: 'aa:bb:cc:dd:ee:ff by a@b.nl', firmwareVersion: '1.2.3.4', name: 'Voordeur',
    }, 's');
    expect(out.url).not.toContain('10.0.0.5');
    expect(out.note).not.toContain('aa:bb');
    expect(out.note).not.toContain('a@b.nl');
    expect(out.firmwareVersion).toBe('1.2.3.4');
    expect(out.name).toBe('Voordeur');
  });
});

describe('DebugRecorder', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ufp-debug-'));
    file = path.join(dir, 'debug-ws.jsonl');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  test('record is a no-op when not recording', async () => {
    const homey = createHomey();
    const rec = new DebugRecorder(homey, { filePath: file });
    await rec.init();
    rec.record('v2-events', { type: 'add' });
    await rec.flush();
    expect(fs.existsSync(file)).toBe(false);
    expect(rec.getStatus().messageCount).toBe(0);
  });

  test('records redacted JSONL lines while active', async () => {
    const homey = createHomey();
    const rec = new DebugRecorder(homey, { filePath: file });
    await rec.init();
    await rec.start(1);
    rec.record('v2-events', Buffer.from(JSON.stringify({ type: 'add', item: { mac: 'AABBCCDDEEFF', token: 't' } })));
    rec.record('access', 'not json from 192.168.1.2');
    await rec.flush();

    const lines = readLines(file);
    expect(lines).toHaveLength(2);
    expect(lines[0].src).toBe('v2-events');
    expect(lines[0].msg.item.mac).toMatch(/^<redacted:/);
    expect(lines[0].msg.item.token).toBe('<removed>');
    expect(lines[1].msg).not.toContain('192.168.1.2');
    expect(rec.getStatus()).toMatchObject({ active: true, messageCount: 2 });
  });

  test('rejects unsupported durations', async () => {
    const rec = new DebugRecorder(createHomey(), { filePath: file });
    await rec.init();
    await expect(rec.start(3)).rejects.toThrow('Invalid recording duration');
  });

  test('auto-stops when the duration timer fires', async () => {
    const homey = createHomey();
    const rec = new DebugRecorder(homey, { filePath: file });
    await rec.init();
    await rec.start(6);
    const stopTimer = homey.timers.find((t) => t.ms === 6 * 60 * 60 * 1000);
    expect(stopTimer).toBeDefined();
    stopTimer.fn();
    await rec.flush();
    expect(rec.isActive()).toBe(false);
    expect(homey.store['ufp:debugRecording']).toMatchObject({ active: false, stopReason: 'duration-elapsed' });
  });

  test('auto-stops at the size cap', async () => {
    const rec = new DebugRecorder(createHomey(), { filePath: file, maxBytes: 200 });
    await rec.init();
    await rec.start(1);
    for (let i = 0; i < 20; i++) rec.record('v1', { action: { modelKey: 'camera' }, payload: { i } });
    await rec.flush();
    expect(rec.isActive()).toBe(false);
    expect(fs.statSync(file).size).toBeLessThanOrEqual(200);
  });

  test('resumes after restart and expires a finished recording', async () => {
    const homey = createHomey();
    const rec = new DebugRecorder(homey, { filePath: file });
    await rec.init();
    await rec.start(1);
    rec.record('v1', { a: 1 });
    await rec.destroy();

    const resumed = new DebugRecorder(homey, { filePath: file });
    await resumed.init();
    expect(resumed.isActive()).toBe(true);
    expect(resumed.getStatus().messageCount).toBe(1);

    homey.store['ufp:debugRecording'].stopAt = Date.now() - 1000;
    const expired = new DebugRecorder(homey, { filePath: file });
    await expired.init();
    expect(expired.isActive()).toBe(false);
    expect(homey.store['ufp:debugRecording'].stopReason).toBe('expired');
  });

  test('readChunk returns whole lines and walks the file', async () => {
    const rec = new DebugRecorder(createHomey(), { filePath: file, chunkBytes: 100 });
    await rec.init();
    await rec.start(1);
    for (let i = 0; i < 10; i++) rec.record('v1', { payload: { i } });

    const all = [];
    let offset = 0;
    for (;;) {
      const chunk = await rec.readChunk(offset);
      expect(chunk.data === '' || chunk.data.endsWith('\n')).toBe(true);
      chunk.data.split('\n').filter(Boolean).forEach((l) => all.push(JSON.parse(l)));
      if (chunk.done) break;
      offset = chunk.nextOffset;
    }
    expect(all.map((l) => l.msg.payload.i)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('readChunk on a missing file is empty', async () => {
    const rec = new DebugRecorder(createHomey(), { filePath: file });
    await expect(rec.readChunk(0)).resolves.toMatchObject({ data: '', done: true });
  });

  test('buildSnapshot includes app info and redacted V1 bootstrap', async () => {
    const homey = createHomey();
    homey.app.isV1Available = () => true;
    homey.app.api = {
      webclient: { get: jest.fn().mockResolvedValue(JSON.stringify({ nvr: { host: '10.1.1.1', name: 'NVR' }, authUserId: 'x', accessKey: 'secret' })) },
      getBootstrap: () => null,
    };
    const rec = new DebugRecorder(homey, { filePath: file });
    await rec.init();
    const snap = await rec.buildSnapshot();
    expect(snap.app.version).toBe('9.9.9');
    expect(snap.protectV1.bootstrap.nvr.name).toBe('NVR');
    expect(snap.protectV1.bootstrap.nvr.host).toMatch(/^<redacted:/);
    expect(snap.protectV1.bootstrap.accessKey).toBe('<removed>');
    expect(snap.protectV2).toBeNull();
  });
});

describe('download link', () => {
  let dir;
  let file;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ufp-debug-'));
    file = path.join(dir, 'debug-ws.jsonl');
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  function createWithCloud() {
    const homey = createHomey();
    homey.cloud = {
      getLocalAddress: jest.fn().mockResolvedValue('192.168.1.5:80'),
      getHomeyId: jest.fn().mockResolvedValue('abc123'),
    };
    return { homey, rec: new DebugRecorder(homey, { filePath: file }) };
  }

  const tokenOf = (url) => new URL(url).searchParams.get('code');

  test('creates local and cloud URLs with the same token', async () => {
    const { rec } = createWithCloud();
    await rec.init();
    const link = await rec.createDownloadLink();
    expect(link.localUrl).toMatch(/^http:\/\/192\.168\.1\.5:80\/api\/app\/com\.ubnt\.unifiprotect\/debug-export\/unifiprotect-debug-\d{8}-\d{4}\.json\?code=[0-9a-f]{48}$/);
    expect(link.cloudUrl).toMatch(/^https:\/\/abc123\.connect\.athom\.com\/api\/app\/com\.ubnt\.unifiprotect\/debug-export\/unifiprotect-debug-\d{8}-\d{4}\.json\?code=/);
    expect(tokenOf(link.localUrl)).toBe(tokenOf(link.cloudUrl));
  });

  test('accepts a valid token a limited number of times and rejects others', async () => {
    const { rec } = createWithCloud();
    await rec.init();
    const token = tokenOf((await rec.createDownloadLink()).localUrl);
    expect(rec.isValidDownloadToken('nope')).toBe(false);
    expect(rec.isValidDownloadToken(undefined)).toBe(false);
    for (let i = 0; i < 5; i++) expect(rec.isValidDownloadToken(token)).toBe(true);
    expect(rec.isValidDownloadToken(token)).toBe(false);
  });

  test('rejects an expired token', async () => {
    const { rec } = createWithCloud();
    await rec.init();
    const token = tokenOf((await rec.createDownloadLink()).localUrl);
    rec._downloadTokens.get(token).expiresAt = Date.now() - 1;
    expect(rec.isValidDownloadToken(token)).toBe(false);
  });

  test('clear revokes previously issued download links', async () => {
    const { rec } = createWithCloud();
    await rec.init();
    const token = tokenOf((await rec.createDownloadLink()).localUrl);
    expect(rec.isValidDownloadToken(token)).toBe(true);
    await rec.clear();
    expect(rec.isValidDownloadToken(token)).toBe(false);
  });

  test('buildExport contains snapshot and recorded messages', async () => {
    const { rec } = createWithCloud();
    await rec.init();
    await rec.start(1);
    rec.record('v1', { payload: { i: 1 } });
    rec.record('access', { event: 'x' });
    const exp = await rec.buildExport();
    expect(exp.app.version).toBe('9.9.9');
    expect(exp.websocketMessages.map((m) => m.src)).toEqual(['v1', 'access']);
  });
});

describe('websocket hook', () => {
  test('V2 events websocket hands every message to the recorder', () => {
    const harness = createWebSocketHarness(ProtectWebSocket, {});
    const record = jest.fn();
    harness.homey.app.debugRecorder = { record };
    harness.emit({ type: 'add', item: { type: 'unknown' } });
    expect(record).toHaveBeenCalledWith('v2-events', expect.any(Buffer));
  });
});
