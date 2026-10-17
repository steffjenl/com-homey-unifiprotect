'use strict';

const CameraDriver = require('../../drivers/protectcamera/driver');
const DoorbellDriver = require('../../drivers/protectdoorbell/driver');

const COMMON = ['onIsRecording', 'onIsMicEnabled', 'onMicVolume', 'onIsConnected', 'onRecordingMode', 'onMotionDetected', 'onSmartDetection', 'onSmartDetectionEnd'];

function createDevice(extra = []) {
  const device = { _events: {} };
  [...COMMON, ...extra].forEach((name) => {
    device[name] = jest.fn();
  });
  device.onNFCCardScanned = jest.fn(() => Promise.resolve());
  device.onFingerprintIdentified = jest.fn(() => Promise.resolve());
  return device;
}

function createDriver(Driver) {
  const driver = Object.create(Driver.prototype);
  driver.homey = { app: { debug: () => {} } };
  driver.error = jest.fn();
  return driver;
}

describe.each([
  ['protectcamera', CameraDriver, ['onIsDark', 'onNightVisionMode']],
  ['protectdoorbell', DoorbellDriver, ['onRingVolume', 'onSpeakerVolume']],
])('%s driver.onParseWebsocketMessage', (_name, Driver, extra) => {
  const driver = createDriver(Driver);

  test('ignores uninitialized devices', () => {
    const device = createDevice(extra);
    delete device._events;
    driver.onParseWebsocketMessage(device, { isRecording: true });
    expect(device.onIsRecording).not.toHaveBeenCalled();
  });

  test('dispatches common state fields', () => {
    const device = createDevice(extra);
    driver.onParseWebsocketMessage(device, {
      isRecording: false,
      isMicEnabled: true,
      micVolume: 80,
      isConnected: true,
      recordingSettings: { mode: 'always' },
    });
    expect(device.onIsRecording).toHaveBeenCalledWith(false); // falsy but present
    expect(device.onIsMicEnabled).toHaveBeenCalledWith(true);
    expect(device.onMicVolume).toHaveBeenCalledWith(80);
    expect(device.onIsConnected).toHaveBeenCalledWith(true);
    expect(device.onRecordingMode).toHaveBeenCalledWith('always');
  });

  test('recordingSettings without mode is ignored', () => {
    const device = createDevice(extra);
    driver.onParseWebsocketMessage(device, { recordingSettings: { other: 1 } });
    expect(device.onRecordingMode).not.toHaveBeenCalled();
  });

  test('smartDetectTypes goes to onSmartDetection with action type and event id', () => {
    const device = createDevice(extra);
    const payload = { smartDetectTypes: ['person'], start: 1 };
    driver.onParseWebsocketMessage(device, payload, 'add', 'ev-1');
    expect(device.onSmartDetection).toHaveBeenCalledWith(payload, 'add', 'ev-1');
    expect(device.onSmartDetectionEnd).not.toHaveBeenCalled();
  });

  test('V1 closing frame without smartDetectTypes goes to onSmartDetectionEnd', () => {
    const device = createDevice(extra);
    const payload = { end: 9 };
    driver.onParseWebsocketMessage(device, payload, 'update', 'ev-1');
    expect(device.onSmartDetectionEnd).toHaveBeenCalledWith(payload, 'ev-1');
  });

  test.each([
    ['no event id', { end: 9 }, 'update', null],
    ['not an update', { end: 9 }, 'add', 'ev-1'],
    ['no end', { name: 'x' }, 'update', 'ev-1'],
  ])('closing frame guard: %s', (_label, payload, actionType, eventId) => {
    const device = createDevice(extra);
    driver.onParseWebsocketMessage(device, payload, actionType, eventId);
    expect(device.onSmartDetectionEnd).not.toHaveBeenCalled();
  });

  test('nfcCardScanned and fingerprintIdentified are dispatched by type', () => {
    const device = createDevice(extra);
    driver.onParseWebsocketMessage(device, { type: 'nfcCardScanned' }, 'add', 'n1');
    driver.onParseWebsocketMessage(device, { type: 'fingerprintIdentified' }, 'add', 'f1');
    expect(device.onNFCCardScanned).toHaveBeenCalledWith({ type: 'nfcCardScanned' }, 'add', 'n1');
    expect(device.onFingerprintIdentified).toHaveBeenCalledWith({ type: 'fingerprintIdentified' }, 'add', 'f1');
  });
});

describe('camera-only fields', () => {
  const driver = createDriver(CameraDriver);

  test('isDark and night vision mode', () => {
    const device = createDevice(['onIsDark', 'onNightVisionMode']);
    driver.onParseWebsocketMessage(device, { isDark: true, ispSettings: { irLedMode: 'auto' } });
    expect(device.onIsDark).toHaveBeenCalledWith(true);
    expect(device.onNightVisionMode).toHaveBeenCalledWith('auto');
  });

  test('lastMotion passes isMotionDetected', () => {
    const device = createDevice(['onIsDark', 'onNightVisionMode']);
    driver.onParseWebsocketMessage(device, { lastMotion: 123, isMotionDetected: true });
    expect(device.onMotionDetected).toHaveBeenCalledWith(123, true);
  });
});

describe('doorbell-only fields', () => {
  test('speakerSettings volumes', () => {
    const driver = createDriver(DoorbellDriver);
    const device = createDevice(['onRingVolume', 'onSpeakerVolume']);
    driver.onParseWebsocketMessage(device, { speakerSettings: { ringVolume: 5, speakerVolume: 7 } });
    expect(device.onRingVolume).toHaveBeenCalledWith(5);
    expect(device.onSpeakerVolume).toHaveBeenCalledWith(7);
  });
});
