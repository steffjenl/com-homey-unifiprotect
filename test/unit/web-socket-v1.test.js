'use strict';

const { EventEmitter } = require('events');
const zlib = require('zlib');
const ProtectWebSocket = require('../../library/websocket');

const HEADER_SIZE = 8;

// Builds one UniFi Protect update frame: 8-byte header (type, format, deflated, 0, size BE) + body.
function frame(frameType, format, body, { deflate = false } = {}) {
  const data = deflate ? zlib.deflateSync(body) : body;
  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt8(frameType, 0);
  header.writeUInt8(format, 1);
  header.writeUInt8(deflate ? 1 : 0, 2);
  header.writeUInt32BE(data.length, 4);
  return Buffer.concat([header, data]);
}

const json = (value) => Buffer.from(JSON.stringify(value));

function encode(action, payload, opts = {}) {
  return Buffer.concat([frame(1, 1, json(action), opts), frame(2, 1, json(payload), opts)]);
}

const emptyDriver = () => ({ getUnifiDeviceById: () => false, onParseWebsocketMessage: jest.fn() });

function createWs({ drivers: extraDrivers = {}, bootstrap = { nvr: {} } } = {}) {
  const drivers = { protectcamera: emptyDriver(), protectdoorbell: emptyDriver(), ...extraDrivers };
  const debugLog = [];
  const ws = new ProtectWebSocket();
  const app = {
    debug: (...args) => debugLog.push(args.join(' ')),
    toLocalTime: (d) => d,
    onFobWebsocketMessage: jest.fn(),
    api: { _bootstrap: bootstrap },
  };
  ws.setHomeyObject({
    app,
    drivers: {
      getDriver: (id) => {
        if (!drivers[id]) throw new Error(`Driver not found: ${id}`);
        return drivers[id];
      },
    },
  });
  return { ws, app, debugLog };
}

function createListeningWs(opts) {
  const setup = createWs(opts);
  setup.ws._eventListener = new EventEmitter();
  setup.ws.configureUpdatesListener();
  setup.send = (action, payload) => setup.ws._eventListener.emit('message', encode(action, payload));
  return setup;
}

describe('decodeUpdatePacket', () => {
  const { ws } = createWs();
  const action = {
    action: 'update', modelKey: 'camera', id: 'c1', newUpdateId: 'u',
  };
  const payload = { isRecording: true };

  test('decodes plain frames', () => {
    expect(ws.decodeUpdatePacket(encode(action, payload))).toEqual({ action, payload });
  });

  test('decodes deflated frames', () => {
    expect(ws.decodeUpdatePacket(encode(action, payload, { deflate: true }))).toEqual({ action, payload });
  });

  test('payload formats 2 (string) and 3 (buffer)', () => {
    const asString = Buffer.concat([frame(1, 1, json(action)), frame(2, 2, Buffer.from('hello'))]);
    expect(ws.decodeUpdatePacket(asString).payload).toBe('hello');

    const asBuffer = Buffer.concat([frame(1, 1, json(action)), frame(2, 3, Buffer.from([1, 2, 3]))]);
    expect(ws.decodeUpdatePacket(asBuffer).payload).toEqual(Buffer.from([1, 2, 3]));
  });

  test('unknown payload format returns null', () => {
    const packet = Buffer.concat([frame(1, 1, json(action)), frame(2, 9, Buffer.from('x'))]);
    expect(ws.decodeUpdatePacket(packet)).toBeNull();
  });

  test('action frame with a non-JSON format returns null', () => {
    const packet = Buffer.concat([frame(1, 2, Buffer.from('x')), frame(2, 1, json(payload))]);
    expect(ws.decodeUpdatePacket(packet)).toBeNull();
  });

  test('frames in the wrong order return null', () => {
    const packet = Buffer.concat([frame(2, 1, json(payload)), frame(1, 1, json(action))]);
    expect(ws.decodeUpdatePacket(packet)).toBeNull();
  });

  test('length mismatch returns null and logs', () => {
    const { ws: w, debugLog } = createWs();
    const packet = encode(action, payload);
    expect(w.decodeUpdatePacket(packet.slice(0, packet.length - 3))).toBeNull();
    expect(w.decodeUpdatePacket(Buffer.concat([packet, Buffer.from('extra')]))).toBeNull();
    expect(debugLog.length).toBeGreaterThanOrEqual(2);
  });

  test('too-short buffer returns null', () => {
    expect(ws.decodeUpdatePacket(Buffer.alloc(3))).toBeNull();
  });

  // KNOWN ISSUE (test/KNOWN_ISSUES.md #8): corrupt JSON inside a correctly-sized frame throws
  // out of decodeUpdateFrame (outside the try/catch), so the 'message' handler throws.
  test.failing('corrupt JSON body returns null instead of throwing', () => {
    const packet = Buffer.concat([frame(1, 1, Buffer.from('{not json')), frame(2, 1, json(payload))]);
    expect(ws.decodeUpdatePacket(packet)).toBeNull();
  });
});

describe('shouldProcessEvent', () => {
  const { ws } = createWs();
  const pkt = (action, modelKey, payload = {}) => ({ action: { action, modelKey }, payload });

  test.each([
    ['camera update', pkt('update', 'camera')],
    ['light update', pkt('update', 'light')],
    ['relay update', pkt('update', 'relay')],
    ['sensor update', pkt('update', 'sensor')],
    ['fob update', pkt('update', 'fob')],
    ['speaker update', pkt('update', 'speaker')],
    ['nvr update', pkt('update', 'nvr')],
    ['externalArmProfile update', pkt('update', 'externalArmProfile')],
    ['viewer update', pkt('update', 'viewer')],
    ['aiport update', pkt('update', 'aiport')],
    ['event add', pkt('add', 'event')],
    ['event update', pkt('update', 'event')],
    ['smartDetectZone add', pkt('add', 'x', { type: 'smartDetectZone' })],
    ['smartAudioDetect add', pkt('add', 'x', { type: 'smartAudioDetect' })],
    ['smartAudioDetect update', pkt('update', 'x', { type: 'smartAudioDetect' })],
  ])('accepts %s', (_label, packet) => {
    expect(ws.shouldProcessEvent(packet)).toBe(true);
  });

  test.each([
    ['null', null],
    ['array', []],
    ['no action', { payload: {} }],
    ['action is array', { action: [], payload: {} }],
    ['no payload', { action: { action: 'update', modelKey: 'camera' } }],
    ['payload is string', { action: { action: 'update', modelKey: 'camera' }, payload: 'x' }],
    ['payload is array', { action: { action: 'update', modelKey: 'camera' }, payload: [] }],
    ['stats payload', pkt('update', 'camera', { stats: {} })],
    ['bridge update', pkt('update', 'bridge')],
    ['user update', pkt('update', 'user')],
    ['camera add', pkt('add', 'camera')],
    ['remove', pkt('remove', 'camera')],
  ])('rejects %s', (_label, packet) => {
    expect(ws.shouldProcessEvent(packet)).toBe(false);
  });
});

describe('_resolveCameraId', () => {
  test('priority: recordId, payload.camera, event map, undefined', () => {
    const { ws } = createWs();
    ws._eventCameraMap.set('ev', 'mapped');
    expect(ws._resolveCameraId({ action: { recordId: 'rec', id: 'ev' }, payload: { camera: 'pay' } })).toBe('rec');
    expect(ws._resolveCameraId({ action: { id: 'ev' }, payload: { camera: 'pay' } })).toBe('pay');
    expect(ws._resolveCameraId({ action: { id: 'ev' }, payload: {} })).toBe('mapped');
    expect(ws._resolveCameraId({ action: { id: 'other' }, payload: {} })).toBeUndefined();
  });
});

describe('_dispatchNvrAlarmPayload', () => {
  const alarmDevice = { n: 'alarm' };
  const makeAlarmDriver = () => ({ getNVRAlarmDevice: jest.fn(() => alarmDevice), onParseWebsocketMessage: jest.fn() });

  test('caches arm state in bootstrap and dispatches to the alarm device', () => {
    const alarm = makeAlarmDriver();
    const bootstrap = { nvr: { isAway: false } };
    const { ws } = createWs({ drivers: { 'protect-nvr-alarm': alarm }, bootstrap });
    const payload = { armMode: { status: 'armed' }, isAway: true };

    ws._dispatchNvrAlarmPayload(payload);

    expect(bootstrap.nvr).toMatchObject({ armMode: { status: 'armed' }, isAway: true });
    expect(alarm.onParseWebsocketMessage).toHaveBeenCalledWith(alarmDevice, payload);
  });

  test.each([[null], [undefined], ['x'], [[1]]])('ignores invalid payload %p', (payload) => {
    const alarm = makeAlarmDriver();
    const { ws } = createWs({ drivers: { 'protect-nvr-alarm': alarm } });
    ws._dispatchNvrAlarmPayload(payload);
    expect(alarm.onParseWebsocketMessage).not.toHaveBeenCalled();
  });

  test('missing driver is swallowed', () => {
    const { ws, debugLog } = createWs();
    expect(() => ws._dispatchNvrAlarmPayload({ isAway: true })).not.toThrow();
    expect(debugLog.some((m) => m.includes('skipping NVR alarm dispatch'))).toBe(true);
  });

  test('no paired alarm device means no dispatch', () => {
    const alarm = { getNVRAlarmDevice: () => false, onParseWebsocketMessage: jest.fn() };
    const { ws } = createWs({ drivers: { 'protect-nvr-alarm': alarm } });
    ws._dispatchNvrAlarmPayload({ isAway: true });
    expect(alarm.onParseWebsocketMessage).not.toHaveBeenCalled();
  });
});

describe('message handler (V1 events)', () => {
  test('undecodable packet is ignored', () => {
    const { ws, app } = createListeningWs();
    expect(() => ws._eventListener.emit('message', Buffer.alloc(3))).not.toThrow();
    expect(app.onFobWebsocketMessage).not.toHaveBeenCalled();
  });

  test('filtered packet does not update lastWebsocketMessage', () => {
    const { ws, send } = createListeningWs();
    send({ action: 'update', modelKey: 'bridge' }, { name: 'x' });
    expect(ws.getLastWebsocketMessageTime()).toBeNull();
  });

  test('sensorButtonPressed events go to the fob pipeline as-is', () => {
    const { send, app } = createListeningWs();
    const action = { action: 'add', modelKey: 'event', id: 'ev1' };
    const payload = { type: 'sensorButtonPressed', device: 'fob-1' };
    send(action, payload);
    expect(app.onFobWebsocketMessage).toHaveBeenCalledWith({ action, payload });
  });

  test.each([
    ['armed', { status: 'armed' }, true],
    ['DISARMED', { status: 'disarmed' }, false],
    ['breach', { status: 'breach' }, undefined],
  ])('nvr alarm event %s is converted to an armMode payload', (type, armMode, isAway) => {
    const alarm = { getNVRAlarmDevice: () => ({}), onParseWebsocketMessage: jest.fn() };
    const bootstrap = { nvr: {} };
    const { send } = createListeningWs({ drivers: { 'protect-nvr-alarm': alarm }, bootstrap });

    send(
      {
        action: 'add', modelKey: 'event', recordModel: 'nvr', id: 'ev',
      },
      { type, metadata: { armProfileId: 'p1', armProfileName: 'Away' } },
    );

    const dispatched = alarm.onParseWebsocketMessage.mock.calls[0][1];
    expect(dispatched.armMode).toEqual({ ...armMode, armProfileId: 'p1', armProfileName: 'Away' });
    expect(dispatched.isAway).toBe(isAway);
    expect(bootstrap.nvr.armMode.status).toBe(armMode.status);
  });

  test('nvr alarm event of another type is not treated as an alarm state', () => {
    const alarm = { getNVRAlarmDevice: () => ({}), onParseWebsocketMessage: jest.fn() };
    const { send } = createListeningWs({ drivers: { 'protect-nvr-alarm': alarm } });
    send({
      action: 'add', modelKey: 'event', recordModel: 'nvr', id: 'ev',
    }, { type: 'motion' });
    expect(alarm.onParseWebsocketMessage).not.toHaveBeenCalled();
  });

  test('smart detection with types is routed to camera and doorbell drivers via payload.camera', () => {
    const cam = { n: 'cam' };
    const bell = { n: 'bell' };
    const drivers = {
      protectcamera: { getUnifiDeviceById: jest.fn(() => cam), onParseWebsocketMessage: jest.fn() },
      protectdoorbell: { getUnifiDeviceById: jest.fn(() => bell), onParseWebsocketMessage: jest.fn() },
    };
    const { send } = createListeningWs({ drivers });
    const payload = { type: 'smartDetectZone', smartDetectTypes: ['person'], camera: 'cam-1' };

    send({ action: 'add', modelKey: 'event', id: 'ev1' }, payload);

    expect(drivers.protectcamera.getUnifiDeviceById).toHaveBeenCalledWith('cam-1');
    expect(drivers.protectcamera.onParseWebsocketMessage).toHaveBeenCalledWith(cam, payload, 'add', 'ev1');
    expect(drivers.protectdoorbell.onParseWebsocketMessage).toHaveBeenCalledWith(bell, payload, 'add', 'ev1');
  });

  test('add events remember their camera for later update frames', () => {
    const { ws, send } = createListeningWs();
    send({ action: 'add', modelKey: 'event', id: 'ev1' }, { type: 'motion', camera: 'cam-9' });
    expect(ws._resolveCameraId({ action: { id: 'ev1' }, payload: {} })).toBe('cam-9');
  });

  test('event camera map is pruned (>24h old entries) once it exceeds 1000', () => {
    const { ws, send } = createListeningWs();
    const old = Date.now() - 2 * 86400000;
    for (let i = 0; i < 1001; i += 1) {
      ws._eventCameraMap.set(`old-${i}`, 'c');
      ws._eventCameraMapTimestamps.set(`old-${i}`, old);
    }
    send({ action: 'add', modelKey: 'event', id: 'fresh' }, { type: 'motion', camera: 'cam-1' });
    expect(ws._eventCameraMap.has('old-0')).toBe(false);
    expect(ws._eventCameraMap.has('fresh')).toBe(true);
    expect(ws._eventCameraMap.size).toBe(1);
  });
});
