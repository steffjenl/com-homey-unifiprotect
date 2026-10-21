'use strict';

const ProtectAPI = require('../../library/protect-api-v2/protect-api');

function createApi(webclient) {
  const api = new ProtectAPI();
  api.webclient = Object.assign(api.webclient, webclient);
  return api;
}

describe('camera listing', () => {
  const cameras = [
    { id: 'plain', featureFlags: { isDoorbell: false }, type: 'UVC G4 Pro' },
    { id: 'bell', featureFlags: { isDoorbell: true } },
    { id: 'chime-cam', featureFlags: { hasChime: true } },
    { id: 'hint-type', featureFlags: {}, type: 'UVC G4 Doorbell Pro' },
    { id: 'hint-market', featureFlags: {}, marketName: 'G6 Entry' },
    { id: 'no-flags' },
  ];
  const api = createApi({ get: async () => JSON.stringify(cameras) });

  test('getDoorbells matches flag, chime and model hints, requires featureFlags', async () => {
    expect((await api.getDoorbells()).map((c) => c.id)).toEqual(['bell', 'chime-cam', 'hint-type', 'hint-market']);
  });

  test('getCamerasNonDoorbell keeps cameras without featureFlags', async () => {
    expect((await api.getCamerasNonDoorbell()).map((c) => c.id)).toEqual(['plain', 'chime-cam', 'hint-type', 'hint-market', 'no-flags']);
  });

  test('errors from the web client are propagated', async () => {
    const failing = createApi({
      get: async () => {
        throw new Error('status code: 401');
      },
    });
    await expect(failing.getCameras()).rejects.toThrow('status code: 401');
  });

  test('invalid JSON rejects', async () => {
    const bad = createApi({ get: async () => 'not json' });
    await expect(bad.getCamera('c1')).rejects.toThrow();
  });
});

describe('simple resource calls', () => {
  test.each([
    ['getLight', ['l1'], 'get', 'lights/l1'],
    ['getRelay', ['r1'], 'get', 'relays/r1'],
    ['getSensor', ['s1'], 'get', 'sensors/s1'],
    ['getChime', ['c1'], 'get', 'chimes/c1'],
  ])('%s hits %s', async (method, args, verb, resource) => {
    const webclient = { [verb]: jest.fn(async () => '{"id":"x"}') };
    const api = createApi(webclient);
    await expect(api[method](...args)).resolves.toEqual({ id: 'x' });
    expect(webclient[verb]).toHaveBeenCalledWith(resource);
  });

  test.each([
    ['setCamera', 'cameras/c1'],
    ['setLight', 'lights/c1'],
    ['setSensor', 'sensors/c1'],
    ['setChime', 'chimes/c1'],
  ])('%s PATCHes the resource with params', async (method, resource) => {
    const webclient = { patch: jest.fn(async () => '{"ok":true}') };
    await expect(createApi(webclient)[method]('c1', { name: 'n' })).resolves.toEqual({ ok: true });
    expect(webclient.patch).toHaveBeenCalledWith(resource, { name: 'n' });
  });
});

describe('relay output', () => {
  const relay = { outputs: [{ id: 1, state: 'off' }, { id: '2', state: 'off', name: 'keep' }] };

  function create() {
    const webclient = {
      get: jest.fn(async () => JSON.stringify(relay)),
      patch: jest.fn(async () => '{"ok":true}'),
    };
    return { api: createApi(webclient), webclient };
  }

  test('sets only the requested output, comparing ids as strings, keeping other fields', async () => {
    const { api, webclient } = create();
    await api.setRelayOutputState('r1', '1', true);
    expect(webclient.patch).toHaveBeenCalledWith('relays/r1', {
      outputs: [{ id: 1, state: 'on' }, { id: '2', state: 'off', name: 'keep' }],
    });
    await api.setRelayOutputState('r1', 2, false);
    expect(webclient.patch.mock.calls[1][1].outputs[1]).toEqual({ id: '2', state: 'off', name: 'keep' });
  });

  test('unknown output rejects without patching', async () => {
    const { api, webclient } = create();
    await expect(api.setRelayOutputState('r1', 9, true)).rejects.toThrow('Relay output 9 not found');
    expect(webclient.patch).not.toHaveBeenCalled();
  });

  test('relay without outputs rejects', async () => {
    const api = createApi({ get: async () => '{}', patch: jest.fn() });
    await expect(api.setRelayOutputState('r1', 1, true)).rejects.toThrow('Relay outputs not found');
  });

  test.each([
    [250, 250],
    ['500', 500],
    [12.6, 13],
    [0, 1000],
    [-5, 1000],
    ['abc', 1000],
    [undefined, 1000],
  ])('pulse duration %p is sent as %p', async (input, expected) => {
    const webclient = { post: jest.fn(async () => '') };
    const result = await createApi(webclient).pulseRelayOutput('r1', 1, input);
    expect(webclient.post).toHaveBeenCalledWith('relays/r1/outputs/1/activate', { pulseDuration: expected });
    expect(result).toBe('Relay output successfully pulsed.');
  });
});

describe('siren', () => {
  test.each([
    [5, 5], [10, 10], [20, 20], [30, 30], ['20', 20], [7, 5], [0, 5], [undefined, 5],
  ])('play duration %p is sent as %p', async (input, expected) => {
    const webclient = { post: jest.fn(async () => '') };
    await createApi(webclient).playSiren('s1', input);
    expect(webclient.post).toHaveBeenCalledWith('sirens/s1/play', { duration: expected });
  });

  test('stop', async () => {
    const webclient = { post: jest.fn(async () => '') };
    await expect(createApi(webclient).stopSiren('s1')).resolves.toBe('Siren successfully stopped.');
    expect(webclient.post).toHaveBeenCalledWith('sirens/s1/stop', {});
  });
});

describe('snapshots and streams', () => {
  const api = createApi({});
  api.setSettings('nvr.local', 443, 'secret-key');

  test('snapshot URL and headers', () => {
    expect(api.getSnapshotUrl('c1', true)).toBe('https://nvr.local:443/proxy/protect/integration/v1/cameras/c1/snapshot?highQuality=true');
    expect(api.getSnapshotUrl('c1')).toContain('highQuality=false');
    expect(api.getSnapshotHeaders()).toEqual({ 'X-API-KEY': 'secret-key' });
  });

  test('getSnapshot requests binary data', async () => {
    const get = jest.fn(async () => Buffer.from([1]));
    const a = createApi({ get });
    await a.getSnapshot('c1');
    expect(get).toHaveBeenCalledWith('cameras/c1/snapshot', {}, true);
  });

  test('getSnapshot passes the channel when requested', async () => {
    const get = jest.fn(async () => Buffer.from([1]));
    const a = createApi({ get });
    await a.getSnapshot('c1', { channel: 'package' });
    expect(get).toHaveBeenCalledWith('cameras/c1/snapshot', { channel: 'package' }, true);
  });

  test('getRtspsStream posts the requested qualities (default high)', async () => {
    const post = jest.fn(async () => '{"high":"rtsps://h:7441/x?enableSrtp"}');
    const a = createApi({ post });
    await expect(a.getRtspsStream('c1')).resolves.toEqual({ high: 'rtsp://h:7447/x' });
    expect(post).toHaveBeenCalledWith('cameras/c1/rtsps-stream', { qualities: ['high'] });
  });
});
