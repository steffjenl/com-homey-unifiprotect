'use strict';

const { createFakeSensorDevice, createFakeBootstrapDevice } = require('../mocks/fake-sensor-device');

// Payload shapes taken from sensorVapeEvent / sensorExtremeValueEvent / sensorAlarmEvent in
// specs/protect-integration-v2-openapi.json (API v7.1.87).

// Structurally identical to a real UP-AirQuality bootstrap capture (id/mac/host scrubbed),
// used to verify _createMissingCapabilities/_initSensorData against real field shapes rather
// than hand-guessed ones.
const AIRQUALITY_BOOTSTRAP_SENSOR = require('../fixtures/bootstrap-sensor-airquality.json');

describe('protectsensor events', () => {
  test('vape event toggles alarm_vape and lazily creates the capability', async () => {
    const device = createFakeSensorDevice();
    await device.onVapeDetected('add', 1779653018028, null);
    expect(device.hasCapability('alarm_vape')).toBe(true);
    expect(device.capabilityValues.alarm_vape).toBe(true);

    await device.onVapeDetected('update', 1779653018028, 1779653020000);
    expect(device.capabilityValues.alarm_vape).toBe(false);
  });

  test.each([
    ['co2', '1200', 'high', 'measure_co2', 1200],
    ['pm2p5', '35.5', 'high', 'measure_pm25', 35.5],
    ['aqi', '180', 'high', 'measure_aqi', 180],
    ['pm4p0', '12', 'normal', 'measure_pm4', 12],
  ])('extreme value %s maps to %s', async (metric, value, level, capability, expected) => {
    const device = createFakeSensorDevice();
    await device.onExtremeValue(metric, value, level);
    expect(device.hasCapability(capability)).toBe(true);
    expect(device.capabilityValues[capability]).toBe(expected);
  });

  test('unmapped extreme value metric adds no capability', async () => {
    const device = createFakeSensorDevice();
    const before = device.capabilities.size;
    await device.onExtremeValue('temperature', '21.5', 'normal');
    expect(device.capabilities.size).toBe(before);
  });

  test('sensor alarm glassBreak activates, smoke clears on end', async () => {
    const device = createFakeSensorDevice();
    await device.onSensorAlarm('glassBreak', 'add', null);
    expect(device.hasCapability('alarm_glassbreak')).toBe(true);
    expect(device.capabilityValues.alarm_glassbreak).toBe(true);

    await device.onSensorAlarm('smoke', 'update', 1779653020000);
    expect(device.hasCapability('alarm_smoke')).toBe(true);
    expect(device.capabilityValues.alarm_smoke).toBe(false);
  });

  test('unmapped alarmType adds no capability', async () => {
    const device = createFakeSensorDevice();
    const before = device.capabilities.size;
    await device.onSensorAlarm('sensorButtonPress', 'add', null);
    expect(device.capabilities.size).toBe(before);
  });
});

describe('protectsensor bootstrap', () => {
  test('UP-AirQuality fixture creates air quality capabilities only', async () => {
    const device = createFakeBootstrapDevice(JSON.parse(JSON.stringify(AIRQUALITY_BOOTSTRAP_SENSOR)));
    await device._createMissingCapabilities();

    // stats.{humidity,temperature} are null -> fall back to airQuality.*
    expect(device.hasCapability('measure_humidity')).toBe(true);
    expect(device.hasCapability('measure_temperature')).toBe(true);
    expect(device.hasCapability('measure_luminance')).toBe(false);
    ['measure_aqi', 'measure_co2', 'measure_tvoc_index', 'measure_tvoc', 'measure_pm1', 'measure_pm25', 'measure_pm4', 'measure_pm10', 'alarm_vape']
      .forEach((capability) => expect(device.hasCapability(capability)).toBe(true));

    // alarmSettings.isEnabled=false -> no smoke/CO; no contact/tamper hardware
    ['alarm_smoke', 'alarm_co', 'alarm_contact', 'alarm_tamper', 'measure_battery']
      .forEach((capability) => expect(device.hasCapability(capability)).toBe(false));
    expect(device.hasCapability('alarm_battery')).toBe(true);

    await device._initSensorData();
    expect(device.capabilityValues).toMatchObject({
      measure_humidity: 40.2,
      measure_temperature: 28.07,
      measure_co2: 494,
      measure_tvoc_index: 74,
      measure_tvoc: 11.6,
      alarm_battery: false,
    });

    // live updates
    device.onAirQualityChange({ co2: { value: 550, status: 'neutral' } });
    expect(device.capabilityValues.measure_co2).toBe(550);
    device.onBatteryStatusChange({ isLow: true, percentage: null });
    expect(device.capabilityValues.alarm_battery).toBe(true);

    // smoke feature disabled at bootstrap -> update must not create the capability
    device.onSmokeStatusChange({ smokeAlarm: true, coAlarm: false });
    expect(device.hasCapability('alarm_smoke')).toBe(false);
  });

  test('plain contact sensor keeps alarm_contact/alarm_tamper, gets no air quality', async () => {
    const device = createFakeBootstrapDevice({
      id: 'plain-sensor-1',
      type: 'UP Sensor',
      isOpened: false,
      stats: {
        light: { value: null, status: 'unknown' },
        humidity: { value: null, status: 'unknown' },
        temperature: { value: null, status: 'unknown' },
      },
      motionSettings: { isEnabled: false },
      alarmSettings: { isEnabled: false },
      glassBreakSettings: { isEnabled: false },
    });
    await device._createMissingCapabilities();

    expect(device.hasCapability('alarm_contact')).toBe(true);
    expect(device.hasCapability('alarm_tamper')).toBe(true);
    ['measure_aqi', 'measure_co2', 'measure_tvoc', 'alarm_vape']
      .forEach((capability) => expect(device.hasCapability(capability)).toBe(false));
  });
});
