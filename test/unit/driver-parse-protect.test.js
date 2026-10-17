'use strict';

const LightDriver = require('../../drivers/protectlight/driver');
const SirenDriver = require('../../drivers/protect-siren/driver');
const ChimeDriver = require('../../drivers/protectchime/driver');
const RelayDriver = require('../../drivers/protect-relay/driver');
const UnifiOsDriver = require('../../drivers/unifi-os/driver');
const ViewportDriver = require('../../drivers/protect-viewport/driver');
const HornSpeakerDriver = require('../../drivers/protect-horn-speaker/driver');
const FobDriver = require('../../drivers/protect-fob/driver');
const AiPortDriver = require('../../drivers/protect-ai-port/driver');
const { createDriverHarness } = require('../mocks/driver-parse');

describe('protectlight', () => {
  const handlers = ['onIsLightOn', 'onMotionDetected', 'onLedLevelChange', 'onLightModeChange'];

  test('dispatches light state, motion, led level and mode', () => {
    const { driver, device } = createDriverHarness(LightDriver, handlers);
    driver.onParseWebsocketMessage(device, {
      isLightOn: false,
      isPirMotionDetected: true,
      lastMotion: 1000,
      lightDeviceSettings: { ledLevel: 4 },
      lightModeSettings: { mode: 'motion', enableAt: 'fulltime' },
    });
    expect(device.onIsLightOn).toHaveBeenCalledWith(false);
    expect(device.onMotionDetected).toHaveBeenCalledWith(1000, true);
    expect(device.onLedLevelChange).toHaveBeenCalledWith(4);
    expect(device.onLightModeChange).toHaveBeenCalledWith({ mode: 'motion', enableAt: 'fulltime' });
  });

  test('settings objects without the relevant key are ignored', () => {
    const { driver, device } = createDriverHarness(LightDriver, handlers);
    driver.onParseWebsocketMessage(device, { lightDeviceSettings: { other: 1 }, lightModeSettings: { other: 1 } });
    expect(device.onLedLevelChange).not.toHaveBeenCalled();
    expect(device.onLightModeChange).not.toHaveBeenCalled();
  });

  test('uninitialized device is ignored', () => {
    const { driver, device } = createDriverHarness(LightDriver, handlers, { initialized: false });
    driver.onParseWebsocketMessage(device, { isLightOn: true });
    expect(device.onIsLightOn).not.toHaveBeenCalled();
  });
});

describe.each([
  ['protect-siren', SirenDriver, 'onIsSirenOn'],
  ['protectchime', ChimeDriver, 'onIsChimeOn'],
])('%s volume', (_name, Driver, handler) => {
  test('volume is dispatched, including 0', () => {
    const { driver, device } = createDriverHarness(Driver, [handler]);
    driver.onParseWebsocketMessage(device, { volume: 0 });
    expect(device[handler]).toHaveBeenCalledWith(0);
  });

  test('payload without volume is ignored', () => {
    const { driver, device } = createDriverHarness(Driver, [handler]);
    driver.onParseWebsocketMessage(device, { name: 'x' });
    expect(device[handler]).not.toHaveBeenCalled();
  });

  test('uninitialized device is ignored', () => {
    const { driver, device } = createDriverHarness(Driver, [handler], { initialized: false });
    driver.onParseWebsocketMessage(device, { volume: 50 });
    expect(device[handler]).not.toHaveBeenCalled();
  });
});

describe('protect-relay', () => {
  test.each([
    ['outputs', { outputs: [] }],
    ['inputs', { inputs: [] }],
  ])('%s update is dispatched', (_label, payload) => {
    const { driver, device } = createDriverHarness(RelayDriver, ['onRelayUpdate']);
    driver.onParseWebsocketMessage(device, payload);
    expect(device.onRelayUpdate).toHaveBeenCalledWith(payload);
  });

  test('update without inputs/outputs is ignored', () => {
    const { driver, device } = createDriverHarness(RelayDriver, ['onRelayUpdate']);
    driver.onParseWebsocketMessage(device, { name: 'x' });
    expect(device.onRelayUpdate).not.toHaveBeenCalled();
  });

  test('getUnifiDevicesByRelayId matches string/number ids and survives errors', () => {
    const { driver } = createDriverHarness(RelayDriver, []);
    const a = { getRelayId: () => 7 };
    const b = { getRelayId: () => '8' };
    driver.getDevices = () => [a, b, { getRelayId: () => 7 }];
    expect(driver.getUnifiDevicesByRelayId('7')).toHaveLength(2);
    expect(driver.getUnifiDevicesByRelayId(8)).toEqual([b]);
    driver.getDevices = () => {
      throw new Error('x');
    };
    expect(driver.getUnifiDevicesByRelayId('7')).toEqual([]);
  });
});

describe('unifi-os', () => {
  const handlers = ['onTemperatureChange', 'onStorageChange'];

  test('dispatches cpu temperature and storage', () => {
    const { driver, device } = createDriverHarness(UnifiOsDriver, handlers);
    driver.onParseWebsocketMessage(device, { systemInfo: { cpu: { temperature: 45 }, storage: { used: 1 } } });
    expect(device.onTemperatureChange).toHaveBeenCalledWith(45);
    expect(device.onStorageChange).toHaveBeenCalledWith({ used: 1 });
  });

  test.each([
    ['no systemInfo', {}],
    ['cpu without temperature', { systemInfo: { cpu: {} } }],
  ])('%s: nothing dispatched', (_label, payload) => {
    const { driver, device } = createDriverHarness(UnifiOsDriver, handlers);
    driver.onParseWebsocketMessage(device, payload);
    expect(device.onTemperatureChange).not.toHaveBeenCalled();
    expect(device.onStorageChange).not.toHaveBeenCalled();
  });
});

describe.each([
  ['protect-viewport', ViewportDriver, 'onViewerUpdate'],
  ['protect-horn-speaker', HornSpeakerDriver, 'onSpeakerUpdate'],
  ['protect-fob', FobDriver, 'onFobUpdate'],
  ['protect-ai-port', AiPortDriver, 'onAiPortUpdate'],
])('%s passes the payload through', (_name, Driver, handler) => {
  test('initialized device receives the payload', () => {
    const { driver, device } = createDriverHarness(Driver, [handler]);
    const payload = { id: 'x', name: 'y' };
    driver.onParseWebsocketMessage(device, payload);
    expect(device[handler]).toHaveBeenCalledWith(payload);
  });

  test('uninitialized device is ignored', () => {
    const { driver, device } = createDriverHarness(Driver, [handler], { initialized: false });
    driver.onParseWebsocketMessage(device, {});
    expect(device[handler]).not.toHaveBeenCalled();
  });
});
