'use strict';

const { createListeningWs } = require('../mocks/fake-v1-websocket');

const driver = (device) => ({
  getUnifiDeviceById: jest.fn(() => device),
  getUnifiDevicesByRelayId: jest.fn(() => (device ? [device] : [])),
  onParseWebsocketMessage: jest.fn(),
});

describe('V1 model updates are routed by action.modelKey and action.id', () => {
  test.each([
    ['light', 'protectlight'],
    ['sensor', 'protectsensor'],
    ['fob', 'protect-fob'],
    ['speaker', 'protect-horn-speaker'],
    ['viewer', 'protect-viewport'],
    ['aiport', 'protect-ai-port'],
  ])('%s -> %s', (modelKey, driverId) => {
    const device = { n: modelKey };
    const d = driver(device);
    const { send } = createListeningWs({ drivers: { [driverId]: d } });
    const payload = { name: 'x' };

    send({ action: 'update', modelKey, id: 'dev-1' }, payload);

    expect(d.getUnifiDeviceById).toHaveBeenCalledWith('dev-1');
    expect(d.onParseWebsocketMessage).toHaveBeenCalledWith(device, payload);
  });

  test.each([
    ['chime', 'protectchime'],
    ['siren', 'protect-siren'],
  ])('%s -> %s', (modelKey, driverId) => {
    const d = driver({ n: modelKey });
    const { send } = createListeningWs({ drivers: { [driverId]: d } });
    send({ action: 'update', modelKey, id: 'dev-1' }, { volume: 3 });
    expect(d.onParseWebsocketMessage).toHaveBeenCalled();
  });

  test('relay update fans out to all devices of that relay', () => {
    const d = driver({ n: 'r' });
    const { send } = createListeningWs({ drivers: { 'protect-relay': d } });
    send({ action: 'update', modelKey: 'relay', id: 'relay-1' }, { outputs: [] });
    expect(d.getUnifiDevicesByRelayId).toHaveBeenCalledWith('relay-1');
    expect(d.onParseWebsocketMessage).toHaveBeenCalledWith({ n: 'r' }, { outputs: [] });
  });

  test('camera update falls through to camera + doorbell drivers', () => {
    const cam = driver({ n: 'cam' });
    const bell = driver({ n: 'bell' });
    const { send } = createListeningWs({ drivers: { protectcamera: cam, protectdoorbell: bell } });
    send({ action: 'update', modelKey: 'camera', id: 'c1' }, { isRecording: true });
    expect(cam.onParseWebsocketMessage).toHaveBeenCalledWith({ n: 'cam' }, { isRecording: true });
    expect(bell.onParseWebsocketMessage).toHaveBeenCalledWith({ n: 'bell' }, { isRecording: true });
  });

  test('unknown device id is a no-op', () => {
    const d = driver(false);
    const { send } = createListeningWs({ drivers: { protectlight: d } });
    send({ action: 'update', modelKey: 'light', id: 'ghost' }, { isLightOn: true });
    expect(d.onParseWebsocketMessage).not.toHaveBeenCalled();
  });
});

describe('V1 nvr updates', () => {
  test('reach unifi-os; arm changes also go to the alarm device and cache in bootstrap', () => {
    const os = driver({ n: 'os' });
    const alarmDevice = { n: 'alarm' };
    const alarm = { getNVRAlarmDevice: () => alarmDevice, onParseWebsocketMessage: jest.fn() };
    const bootstrap = { nvr: {} };
    const { send } = createListeningWs({ drivers: { 'unifi-os': os, 'protect-nvr-alarm': alarm }, bootstrap });
    const payload = { isAway: true, systemInfo: {} };

    send({ action: 'update', modelKey: 'nvr', id: 'nvr-1' }, payload);

    expect(os.getUnifiDeviceById).toHaveBeenCalledWith('unifi-os-controller');
    expect(os.onParseWebsocketMessage).toHaveBeenCalledWith({ n: 'os' }, payload);
    expect(alarm.onParseWebsocketMessage).toHaveBeenCalledWith(alarmDevice, payload);
    expect(bootstrap.nvr.isAway).toBe(true);
  });

  test('plain nvr update (no arm fields) does not touch the alarm device', () => {
    const alarm = { getNVRAlarmDevice: () => ({}), onParseWebsocketMessage: jest.fn() };
    const { send } = createListeningWs({ drivers: { 'unifi-os': driver(false), 'protect-nvr-alarm': alarm } });
    send({ action: 'update', modelKey: 'nvr', id: 'nvr-1' }, { systemInfo: {} });
    expect(alarm.onParseWebsocketMessage).not.toHaveBeenCalled();
  });

  test.each([
    ['armed', true],
    ['DISARMED', false],
    ['breach', undefined],
  ])('externalArmProfile state %s becomes an armMode payload', (state, isAway) => {
    const alarm = { getNVRAlarmDevice: () => ({}), onParseWebsocketMessage: jest.fn() };
    const { send } = createListeningWs({ drivers: { 'protect-nvr-alarm': alarm } });
    send({ action: 'update', modelKey: 'externalArmProfile', id: 'p1' }, { state, id: 'p1', title: 'Away' });
    const dispatched = alarm.onParseWebsocketMessage.mock.calls[0][1];
    expect(dispatched.armMode).toEqual({ status: state.toLowerCase(), armProfileId: 'p1', armProfileName: 'Away' });
    expect(dispatched.isAway).toBe(isAway);
  });

  test.each([
    ['unknown state', { state: 'pending' }],
    ['no state', { title: 'x' }],
  ])('externalArmProfile with %s is ignored', (_label, payload) => {
    const alarm = { getNVRAlarmDevice: () => ({}), onParseWebsocketMessage: jest.fn() };
    const { send } = createListeningWs({ drivers: { 'protect-nvr-alarm': alarm } });
    send({ action: 'update', modelKey: 'externalArmProfile', id: 'p1' }, payload);
    expect(alarm.onParseWebsocketMessage).not.toHaveBeenCalled();
  });
});

describe('V1 event packets', () => {
  const eventAction = (extra = {}) => ({
    action: 'add', modelKey: 'event', id: 'ev-1', ...extra,
  });

  function sensorSetup() {
    const sensor = {
      onVapeDetected: jest.fn(),
      onSmokeSubEvent: jest.fn(),
      onExtremeValue: jest.fn(),
      onSensorAlarm: jest.fn(),
      onTamperDetected: jest.fn(),
    };
    const sensorDriver = driver(sensor);
    return { sensor, sensorDriver, ...createListeningWs({ drivers: { protectsensor: sensorDriver } }) };
  }

  test('sensorVape', () => {
    const { send, sensor, sensorDriver } = sensorSetup();
    send(eventAction(), { type: 'sensorVape', device: 's1', start: 1 });
    expect(sensorDriver.getUnifiDeviceById).toHaveBeenCalledWith('s1');
    expect(sensor.onVapeDetected).toHaveBeenCalledWith('add', 1, null);
  });

  test('sensorSmokeNeedsCleaning', () => {
    const { send, sensor } = sensorSetup();
    send(eventAction({ action: 'update' }), { type: 'sensorSmokeNeedsCleaning', device: 's1', end: 5 });
    expect(sensor.onSmokeSubEvent).toHaveBeenCalledWith('sensorSmokeNeedsCleaning', 'update', 5);
  });

  test('sensorExtremeValues', () => {
    const { send, sensor } = sensorSetup();
    send(eventAction(), {
      type: 'sensorExtremeValues',
      device: 's1',
      metadata: { sensorType: { text: 'co2' }, sensorValue: { text: '900' }, status: { text: 'high' } },
    });
    expect(sensor.onExtremeValue).toHaveBeenCalledWith('co2', '900', 'high');
  });

  test('sensorAlarm', () => {
    const { send, sensor } = sensorSetup();
    send(eventAction(), { type: 'sensorAlarm', device: 's1', metadata: { alarmType: { text: 'glassBreak' } } });
    expect(sensor.onSensorAlarm).toHaveBeenCalledWith('glassBreak', 'add', null);
  });

  // Regression for #56: the clearing frame (update + end) must reach the sensor.
  test.each([
    ['add', { start: 1 }, [1, null]],
    ['update', { start: 1, end: 2 }, [1, 2]],
  ])('sensorTamper %s', (action, extra, args) => {
    const { send, sensor } = sensorSetup();
    send(eventAction({ action }), { type: 'sensorTamper', device: 's1', ...extra });
    expect(sensor.onTamperDetected).toHaveBeenCalledWith(...args);
  });

  test('sensorTamper update without end does not reach the sensor', () => {
    const { send, sensor } = sensorSetup();
    send(eventAction({ action: 'update' }), { type: 'sensorTamper', device: 's1', start: 1 });
    expect(sensor.onTamperDetected).not.toHaveBeenCalled();
  });

  test('sensor events for an unknown sensor are ignored', () => {
    const d = driver(false);
    const { send } = createListeningWs({ drivers: { protectsensor: d } });
    expect(() => send(eventAction(), { type: 'sensorVape', device: 'ghost' })).not.toThrow();
  });

  test('ring calls the doorbell using the resolved camera id', () => {
    const bell = { onDoorbellRinging: jest.fn() };
    const bellDriver = driver(bell);
    const { send } = createListeningWs({ drivers: { protectdoorbell: bellDriver } });
    send(eventAction({ recordId: 'cam-7' }), { type: 'ring', start: 42 });
    expect(bellDriver.getUnifiDeviceById).toHaveBeenCalledWith('cam-7');
    expect(bell.onDoorbellRinging).toHaveBeenCalledWith(42);
  });

  test('smartAudioDetect calls onAudioDetection on camera and doorbell', () => {
    const cam = { onAudioDetection: jest.fn() };
    const bell = { onAudioDetection: jest.fn() };
    const { send } = createListeningWs({ drivers: { protectcamera: driver(cam), protectdoorbell: driver(bell) } });
    const payload = { type: 'smartAudioDetect', camera: 'c1', smartDetectTypes: [] };
    send(eventAction(), payload);
    expect(cam.onAudioDetection).toHaveBeenCalledWith(payload, 'add', 'ev-1');
    expect(bell.onAudioDetection).toHaveBeenCalledWith(payload, 'add', 'ev-1');
  });

  test.each(['nfcCardScanned', 'fingerprintIdentified'])('%s goes to doorbell and camera drivers', (type) => {
    const cam = driver({ n: 'cam' });
    const bell = driver({ n: 'bell' });
    const { send } = createListeningWs({ drivers: { protectcamera: cam, protectdoorbell: bell } });
    const payload = { type, camera: 'c1' };
    send(eventAction(), payload);
    expect(bell.onParseWebsocketMessage).toHaveBeenCalledWith({ n: 'bell' }, payload, 'add', 'ev-1');
    expect(cam.onParseWebsocketMessage).toHaveBeenCalledWith({ n: 'cam' }, payload, 'add', 'ev-1');
  });

  test.each(['smartDetectLine', 'smartDetectLoiterZone', 'smartDetectZone'])('%s without types is still forwarded (end of detection etc.)', (type) => {
    const cam = driver({ n: 'cam' });
    const { send } = createListeningWs({ drivers: { protectcamera: cam } });
    const payload = { type, camera: 'c1', smartDetectTypes: [] };
    send(eventAction(), payload);
    expect(cam.onParseWebsocketMessage).toHaveBeenCalledWith({ n: 'cam' }, payload, 'add', 'ev-1');
  });

  test('closing frame of a known event (no type, no types) reaches the camera via the event map', () => {
    const cam = driver({ n: 'cam' });
    const { send } = createListeningWs({ drivers: { protectcamera: cam } });
    send(eventAction(), { type: 'motion', camera: 'c1' }); // remembers ev-1 -> c1
    send(eventAction({ action: 'update' }), { end: 99 });
    expect(cam.getUnifiDeviceById).toHaveBeenLastCalledWith('c1');
    expect(cam.onParseWebsocketMessage).toHaveBeenCalledWith({ n: 'cam' }, { end: 99 }, 'update', 'ev-1');
  });

  test('doorAccess goes to the app, access goes to the NVR access handler', () => {
    const { send, app } = createListeningWs();
    app.onParseWebsocketMessage = jest.fn();
    app.onNvrAccessWebsocketMessage = jest.fn();
    const door = { type: 'doorAccess' };
    const access = { type: 'access' };
    send(eventAction(), door);
    send(eventAction(), access);
    expect(app.onParseWebsocketMessage).toHaveBeenCalledWith(door);
    expect(app.onNvrAccessWebsocketMessage).toHaveBeenCalledWith(access);
  });
});
