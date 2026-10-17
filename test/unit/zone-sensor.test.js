'use strict';

// Per-zone motion sensor (drivers/protect-zone-sensor) and its feed from SmartDetectionMixin:
// alarm_motion on while a matching detection is open in the zone, off on end.

const ZoneSensorDevice = require('../../drivers/protect-zone-sensor/device');
const ZoneSensorDriver = require('../../drivers/protect-zone-sensor/driver');
const { createSmartDetectionDevice } = require('../mocks/fake-smart-detection-device');

function createSensor(zoneId, enabledTypes) {
  const timers = new Map();
  let timerId = 0;
  const device = Object.create(ZoneSensorDevice.prototype);
  device.timers = timers;
  device.homey = {
    app: { debug: () => {} },
    setTimeout: (fn) => {
      timerId += 1;
      timers.set(timerId, fn);
      return timerId;
    },
    clearTimeout: (id) => {
      timers.delete(id);
    },
  };
  device.values = { alarm_motion: false };
  device.getData = () => ({ id: `cam-1:${zoneId}`, cameraId: 'cam-1', zoneId });
  device.getSetting = (key) => enabledTypes.includes(key.replace('ufp:type_', ''));
  device.getCapabilityValue = (name) => device.values[name];
  device.setCapabilityValue = (name, value) => {
    device.values[name] = value;
    return Promise.resolve();
  };
  device.error = (e) => {
    throw e;
  };
  device._openEvents = new Map();
  return device;
}

describe('zone sensor device', () => {
  test('on for matching zone + type, ignores other zone / disabled type, off on close', () => {
    const sensor = createSensor('1', ['person']);
    sensor.onZoneDetection('e1', ['person'], ['1']);
    expect(sensor.values.alarm_motion).toBe(true);

    sensor.onZoneDetection('e2', ['person'], ['2']);
    expect(sensor._openEvents.size).toBe(1);
    sensor.onZoneDetection('e3', ['vehicle'], ['1']);
    expect(sensor._openEvents.size).toBe(1);

    sensor.onZoneDetectionEnded('e1');
    expect(sensor.values.alarm_motion).toBe(false);
  });

  test('overlapping events keep it on until the last one closes', () => {
    const sensor = createSensor('1', ['person']);
    sensor.onZoneDetection('a', ['person'], ['1']);
    sensor.onZoneDetection('b', ['person'], ['1']);
    sensor.onZoneDetectionEnded('a');
    expect(sensor.values.alarm_motion).toBe(true);
    sensor.onZoneDetectionEnded('b');
    expect(sensor.values.alarm_motion).toBe(false);
  });

  test('event leaving the zone closes', () => {
    const sensor = createSensor('1', ['person']);
    sensor.onZoneDetection('c', ['person'], ['1']);
    sensor.onZoneDetection('c', ['person'], ['2']);
    expect(sensor.values.alarm_motion).toBe(false);
  });

  test('stale safety timer turns it off and no timers leak', () => {
    const sensor = createSensor('1', ['person']);
    sensor.onZoneDetection('d', ['person'], ['1']);
    const fire = [...sensor.timers.values()].pop();
    fire();
    expect(sensor.values.alarm_motion).toBe(false);
    sensor._clearAll();
    expect(sensor.timers.size).toBe(0);
  });
});

test('mixin -> driver -> device, late frame after end does not re-open', () => {
  const sensor = createSensor('1', ['person']);
  const driver = Object.create(ZoneSensorDriver.prototype);
  driver.getDevices = () => [sensor];

  const cam = createSmartDetectionDevice({ homey: { drivers: { getDriver: () => driver } } });
  cam._smartDetectZones = [{ id: 1, name: 'Driveway' }];

  const zoneFrame = { smartDetectTypes: ['person'], metadata: { zonesStatus: { 1: { status: 'enter' } } } };
  cam.onSmartDetection({ ...zoneFrame, start: 1, score: 60 }, 'add', 'ev');
  expect(sensor.values.alarm_motion).toBe(true);

  cam.onSmartDetection({ smartDetectTypes: [], end: 9 }, 'update', 'ev');
  expect(sensor.values.alarm_motion).toBe(false);

  cam.onSmartDetection(zoneFrame, 'update', 'ev');
  expect(sensor.values.alarm_motion).toBe(false);
});
