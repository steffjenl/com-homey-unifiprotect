'use strict';

const SensorDriver = require('../../drivers/protectsensor/driver');

const HANDLERS = [
  'onTemperatureChange', 'onHumidityChange', 'onLightChange', 'onDoorChange', 'onMotionDetected',
  'onAirQualityChange', 'onBatteryStatusChange', 'onSmokeStatusChange', 'refreshSensorData',
];

function createSensor() {
  const sensor = { _events: {} }; // driver only dispatches to initialized Homey devices
  HANDLERS.forEach((name) => {
    sensor[name] = jest.fn();
  });
  return sensor;
}

const driver = Object.create(SensorDriver.prototype);

describe('protectsensor driver.onParseWebsocketMessage', () => {
  test('ignores devices that are not initialized yet', () => {
    const sensor = createSensor();
    delete sensor._events;
    driver.onParseWebsocketMessage(sensor, { isOpened: true });
    expect(sensor.onDoorChange).not.toHaveBeenCalled();
    expect(sensor.refreshSensorData).not.toHaveBeenCalled();
  });

  test('dispatches each present field to its handler', () => {
    const sensor = createSensor();
    driver.onParseWebsocketMessage(sensor, {
      stats: { temperature: { value: 21.5 }, humidity: { value: 40 }, light: { value: 120 } },
      isOpened: true,
      motionDetectedAt: 1000,
      isMotionDetected: true,
      airQuality: { co2: { value: 500 } },
      batteryStatus: { isLow: true },
      smokeStatus: { smokeAlarm: false },
    });

    expect(sensor.onTemperatureChange).toHaveBeenCalledWith(21.5);
    expect(sensor.onHumidityChange).toHaveBeenCalledWith(40);
    expect(sensor.onLightChange).toHaveBeenCalledWith(120);
    expect(sensor.onDoorChange).toHaveBeenCalledWith(true);
    expect(sensor.onMotionDetected).toHaveBeenCalledWith(1000, true);
    expect(sensor.onAirQualityChange).toHaveBeenCalledWith({ co2: { value: 500 } });
    expect(sensor.onBatteryStatusChange).toHaveBeenCalledWith({ isLow: true });
    expect(sensor.onSmokeStatusChange).toHaveBeenCalledWith({ smokeAlarm: false });
    expect(sensor.refreshSensorData).toHaveBeenCalledTimes(1);
  });

  test('isOpened=false is still dispatched (falsy but present)', () => {
    const sensor = createSensor();
    driver.onParseWebsocketMessage(sensor, { isOpened: false });
    expect(sensor.onDoorChange).toHaveBeenCalledWith(false);
  });

  test('absent fields are not dispatched', () => {
    const sensor = createSensor();
    driver.onParseWebsocketMessage(sensor, { name: 'renamed' });
    HANDLERS.filter((h) => h !== 'refreshSensorData').forEach((h) => expect(sensor[h]).not.toHaveBeenCalled());
    expect(sensor.refreshSensorData).toHaveBeenCalledTimes(1);
  });

  test('partial stats only dispatch the stats present', () => {
    const sensor = createSensor();
    driver.onParseWebsocketMessage(sensor, { stats: { humidity: { value: 55 } } });
    expect(sensor.onHumidityChange).toHaveBeenCalledWith(55);
    expect(sensor.onTemperatureChange).not.toHaveBeenCalled();
    expect(sensor.onLightChange).not.toHaveBeenCalled();
  });
});

describe('protectsensor driver.getUnifiDeviceById', () => {
  test('matches string and number ids, returns false when unknown or on error', () => {
    const d = Object.create(SensorDriver.prototype);
    d.getDevices = () => [{ getData: () => ({ id: 42 }) }];
    expect(d.getUnifiDeviceById('42')).toBeTruthy();
    expect(d.getUnifiDeviceById('nope')).toBe(false);

    d.getDevices = () => {
      throw new Error('not ready');
    };
    expect(d.getUnifiDeviceById('42')).toBe(false);
  });
});
