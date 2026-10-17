'use strict';

const { createFakeSensorDevice, createFakeBootstrapDevice } = require('../mocks/fake-sensor-device');

// Regression for #56: alarm_tamper was only ever set to true and never cleared.
describe('protectsensor alarm_tamper', () => {
  test('tamper event without end sets alarm_tamper true', async () => {
    const device = createFakeSensorDevice();
    await device.onTamperDetected(1779653018028, null);
    expect(device.capabilityValues.alarm_tamper).toBe(true);
  });

  test('tamper event with end time resets alarm_tamper', async () => {
    const device = createFakeSensorDevice();
    await device.onTamperDetected(1779653018028, null);
    await device.onTamperDetected(1779653018028, 1779653020000);
    expect(device.capabilityValues.alarm_tamper).toBe(false);
  });

  test.each([
    ['tamperingDetectedAt null', null, false],
    ['tamperingDetectedAt set', 1779653018028, true],
  ])('bootstrap sync: %s', async (_label, tamperingDetectedAt, expected) => {
    const sensor = {
      id: 'sensor-1',
      isOpened: false,
      tamperingDetectedAt,
      stats: { light: { value: null }, humidity: { value: null }, temperature: { value: null } },
    };
    const device = createFakeBootstrapDevice(sensor);
    device.capabilities.add('alarm_tamper');

    await device._initSensorData();
    expect(device.capabilityValues.alarm_tamper).toBe(expected);
  });
});
