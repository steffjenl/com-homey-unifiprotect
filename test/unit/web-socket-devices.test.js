'use strict';

const ProtectWebSocket = require('../../library/protect-api-v2/web-socket-devices');
const { createWebSocketHarness } = require('../mocks/fake-v2-websocket');

function createDriver(device) {
  return {
    getUnifiDeviceById: jest.fn(() => device),
    onParseWebsocketMessage: jest.fn(),
  };
}

// modelKey -> driver id, for every model routed through getUnifiDeviceById.
const SIMPLE_ROUTES = [
  ['light', 'protectlight'],
  ['sensor', 'protectsensor'],
  ['chime', 'protectchime'],
  ['viewer', 'protect-viewport'],
  ['speaker', 'protect-horn-speaker'],
  ['fob', 'protect-fob'],
  ['aiport', 'protect-ai-port'],
  ['siren', 'protect-siren'],
];

describe('V2 devices websocket routing', () => {
  test.each(SIMPLE_ROUTES)('modelKey %s routes to driver %s', (modelKey, driverId) => {
    const device = { name: modelKey };
    const driver = createDriver(device);
    const { emit } = createWebSocketHarness(ProtectWebSocket, { [driverId]: driver });
    const payload = { id: 'dev-1', modelKey, name: 'x' };

    emit({ type: 'update', item: payload });

    expect(driver.getUnifiDeviceById).toHaveBeenCalledWith('dev-1');
    expect(driver.onParseWebsocketMessage).toHaveBeenCalledWith(device, payload);
  });

  test.each(SIMPLE_ROUTES)('modelKey %s with no paired device is a no-op', (modelKey, driverId) => {
    const driver = createDriver(null);
    const { emit } = createWebSocketHarness(ProtectWebSocket, { [driverId]: driver });
    emit({ type: 'update', item: { id: 'dev-1', modelKey } });
    expect(driver.onParseWebsocketMessage).not.toHaveBeenCalled();
  });

  test('camera update reaches both camera and doorbell drivers', () => {
    const camera = createDriver({ n: 'cam' });
    const doorbell = createDriver({ n: 'bell' });
    const { emit } = createWebSocketHarness(ProtectWebSocket, { protectcamera: camera, protectdoorbell: doorbell });
    const payload = { id: 'c1', modelKey: 'camera' };

    emit({ type: 'update', item: payload });

    expect(camera.onParseWebsocketMessage).toHaveBeenCalledWith({ n: 'cam' }, payload);
    expect(doorbell.onParseWebsocketMessage).toHaveBeenCalledWith({ n: 'bell' }, payload);
  });

  test('camera that is only a doorbell updates just the doorbell driver', () => {
    const camera = createDriver(null);
    const doorbell = createDriver({ n: 'bell' });
    const { emit } = createWebSocketHarness(ProtectWebSocket, { protectcamera: camera, protectdoorbell: doorbell });
    emit({ type: 'update', item: { id: 'c1', modelKey: 'camera' } });
    expect(camera.onParseWebsocketMessage).not.toHaveBeenCalled();
    expect(doorbell.onParseWebsocketMessage).toHaveBeenCalled();
  });

  test('relay update fans out to every device sharing the relay id', () => {
    const devices = [{ n: 1 }, { n: 2 }];
    const driver = { getUnifiDevicesByRelayId: jest.fn(() => devices), onParseWebsocketMessage: jest.fn() };
    const { emit } = createWebSocketHarness(ProtectWebSocket, { 'protect-relay': driver });
    const payload = { id: 'r1', modelKey: 'relay' };

    emit({ type: 'update', item: payload });

    expect(driver.getUnifiDevicesByRelayId).toHaveBeenCalledWith('r1');
    expect(driver.onParseWebsocketMessage).toHaveBeenCalledTimes(2);
    expect(driver.onParseWebsocketMessage).toHaveBeenCalledWith(devices[1], payload);
  });

  describe('nvr', () => {
    const payload = { id: 'nvr-1', modelKey: 'nvr', isAway: true };

    test('updates the alarm device and the unifi-os controller', () => {
      const alarmDevice = { n: 'alarm' };
      const osDevice = { n: 'os' };
      const alarm = { getNVRAlarmDevice: jest.fn(() => alarmDevice), onParseWebsocketMessage: jest.fn() };
      const os = createDriver(osDevice);
      const { emit } = createWebSocketHarness(ProtectWebSocket, { 'protect-nvr-alarm': alarm, 'unifi-os': os });

      emit({ type: 'update', item: payload });

      expect(alarm.onParseWebsocketMessage).toHaveBeenCalledWith(alarmDevice, payload);
      expect(os.getUnifiDeviceById).toHaveBeenCalledWith('unifi-os-controller');
      expect(os.onParseWebsocketMessage).toHaveBeenCalledWith(osDevice, payload);
    });

    test('missing alarm driver does not block the unifi-os update', () => {
      const os = createDriver({ n: 'os' });
      const { emit } = createWebSocketHarness(ProtectWebSocket, { 'unifi-os': os });
      emit({ type: 'update', item: payload });
      expect(os.onParseWebsocketMessage).toHaveBeenCalled();
    });

    test('missing unifi-os driver does not block the alarm update', () => {
      const alarm = { getNVRAlarmDevice: () => ({ n: 'alarm' }), onParseWebsocketMessage: jest.fn() };
      const { emit } = createWebSocketHarness(ProtectWebSocket, { 'protect-nvr-alarm': alarm });
      emit({ type: 'update', item: payload });
      expect(alarm.onParseWebsocketMessage).toHaveBeenCalled();
    });
  });

  describe('guards', () => {
    test.each([
      ['no item', { type: 'update' }],
      ['item without modelKey', { type: 'update', item: { id: 'x' } }],
    ])('%s is ignored', (_label, msg) => {
      const driver = createDriver({});
      const { emit } = createWebSocketHarness(ProtectWebSocket, { protectlight: driver });
      emit(msg);
      expect(driver.getUnifiDeviceById).not.toHaveBeenCalled();
    });

    test('malformed JSON is ignored and logged, not thrown', () => {
      const { emit, debugLog } = createWebSocketHarness(ProtectWebSocket, {});
      expect(() => emit('not json')).not.toThrow();
      expect(debugLog.some((m) => m.includes('malformed websocket message'))).toBe(true);
    });

    test('unknown modelKey is ignored', () => {
      const { emit, ws } = createWebSocketHarness(ProtectWebSocket, {});
      expect(() => emit({ type: 'update', item: { id: 'x', modelKey: 'hologram' } })).not.toThrow();
      expect(ws.getLastWebsocketMessageTime()).not.toBeNull();
    });

    test('driver error is swallowed and logged', () => {
      const driver = createDriver({});
      driver.onParseWebsocketMessage.mockImplementation(() => {
        throw new Error('boom');
      });
      const { emit, debugLog } = createWebSocketHarness(ProtectWebSocket, { protectlight: driver });
      expect(() => emit({ type: 'update', item: { id: 'l1', modelKey: 'light' } })).not.toThrow();
      expect(debugLog.some((m) => m.includes('dispatch error'))).toBe(true);
    });

    test('configureNotificationsListener registers only once', () => {
      const { ws } = createWebSocketHarness(ProtectWebSocket, {});
      expect(ws._eventListener.listenerCount('message')).toBe(1);
      ws.configureNotificationsListener();
      expect(ws._eventListener.listenerCount('message')).toBe(1);
    });
  });
});
