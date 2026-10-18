'use strict';

const LightDevice = require('../../drivers/protectlight/device');

function createLight(lastMotionAt = null) {
  const device = Object.create(LightDevice.prototype);
  device.values = { last_motion_at: lastMotionAt };
  device.homey = { app: { debug: () => {}, toLocalTime: (d) => d } };
  device.getData = () => ({ id: 'light-1' });
  device.getCapabilityValue = (name) => device.values[name];
  device.setCapabilityValue = jest.fn((name, value) => {
    device.values[name] = value;
    return Promise.resolve();
  });
  device.onMotionStart = jest.fn();
  device.onMotionEnd = jest.fn();
  device.error = (e) => {
    throw e;
  };
  return device;
}

describe('protectlight onMotionDetected', () => {
  test('first motion timestamp is stored', () => {
    const device = createLight();
    device.onMotionDetected(1000, true);
    expect(device.values.last_motion_at).toBe(1000);
  });

  // Regression: a PIR update without lastMotion used to write `undefined` into last_motion_at.
  test('missing timestamp does not overwrite last_motion_at', () => {
    const device = createLight();
    device.onMotionDetected(undefined, true);
    expect(device.setCapabilityValue).not.toHaveBeenCalled();
  });

  test('newer motion updates the capabilities and starts motion', () => {
    const device = createLight(1000);
    device.onMotionDetected(2000, true);
    expect(device.values.last_motion_at).toBe(2000);
    expect(device.onMotionStart).toHaveBeenCalledTimes(1);
  });

  test('older motion is ignored', () => {
    const device = createLight(2000);
    device.onMotionDetected(1000, true);
    expect(device.setCapabilityValue).not.toHaveBeenCalled();
    expect(device.onMotionStart).not.toHaveBeenCalled();
  });
});
