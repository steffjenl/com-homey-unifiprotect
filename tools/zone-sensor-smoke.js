'use strict';

// Smoke test for the per-zone motion sensor (drivers/protect-zone-sensor) and its feed from
// SmartDetectionMixin: alarm_motion on while a matching detection is open in the zone, off on end.

const assert = require('assert');
const Module = require('module');

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'homey') {
    return { Device: class Device {}, Driver: class Driver {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const ZoneSensorDevice = require('../drivers/protect-zone-sensor/device');
const ZoneSensorDriver = require('../drivers/protect-zone-sensor/driver');
const SmartDetectionMixin = require('../library/SmartDetectionMixin');

const timers = new Map();
let timerId = 0;

function createSensor(zoneId, enabledTypes) {
  const device = Object.create(ZoneSensorDevice.prototype);
  device.homey = {
    app: { debug: () => {} },
    setTimeout: (fn) => { timerId += 1; timers.set(timerId, fn); return timerId; },
    clearTimeout: (id) => { timers.delete(id); },
  };
  device.values = { alarm_motion: false };
  device.getData = () => ({ id: `cam-1:${zoneId}`, cameraId: 'cam-1', zoneId });
  device.getSetting = (key) => enabledTypes.includes(key.replace('ufp:type_', ''));
  device.getCapabilityValue = (name) => device.values[name];
  device.setCapabilityValue = (name, value) => { device.values[name] = value; return Promise.resolve(); };
  device.error = (e) => { throw e; };
  device._openEvents = new Map();
  return device;
}

// Device logic
{
  const sensor = createSensor('1', ['person']);
  sensor.onZoneDetection('e1', ['person'], ['1']);
  assert.strictEqual(sensor.values.alarm_motion, true, 'on for matching zone + type');
  sensor.onZoneDetection('e2', ['person'], ['2']);
  assert.strictEqual(sensor._openEvents.size, 1, 'other zone ignored');
  sensor.onZoneDetection('e3', ['vehicle'], ['1']);
  assert.strictEqual(sensor._openEvents.size, 1, 'disabled type ignored');
  sensor.onZoneDetectionEnded('e1');
  assert.strictEqual(sensor.values.alarm_motion, false, 'off when closed');

  // Overlapping events: stays on until the last one closes
  sensor.onZoneDetection('a', ['person'], ['1']);
  sensor.onZoneDetection('b', ['person'], ['1']);
  sensor.onZoneDetectionEnded('a');
  assert.strictEqual(sensor.values.alarm_motion, true);
  sensor.onZoneDetectionEnded('b');
  assert.strictEqual(sensor.values.alarm_motion, false);

  // Event moves out of the zone / loses its matching type -> closes
  sensor.onZoneDetection('c', ['person'], ['1']);
  sensor.onZoneDetection('c', ['person'], ['2']);
  assert.strictEqual(sensor.values.alarm_motion, false);

  // Stale safety timer turns it off, no leaked timers afterwards
  sensor.onZoneDetection('d', ['person'], ['1']);
  const fire = [...timers.values()].pop();
  fire();
  assert.strictEqual(sensor.values.alarm_motion, false, 'stale timer clears');
  sensor._clearAll();
  assert.strictEqual(timers.size, 0, 'no timers leaked');
}

// Mixin -> driver -> device, incl. late frame after end
{
  const sensor = createSensor('1', ['person']);
  const driver = Object.create(ZoneSensorDriver.prototype);
  driver.getDevices = () => [sensor];

  const cam = Object.assign({}, SmartDetectionMixin);
  cam.homey = {
    app: {
      debug: () => {},
      getUnixTimestamp: () => Date.now(),
      toLocalTime: (d) => d,
      isV1Available: () => false,
      _smartDetectionTrigger: { trigger: async () => {} },
      _smartDetectionTriggerPerson: { trigger: async () => {} },
      _smartDetectionEndedTrigger: { trigger: async () => {} },
    },
    drivers: { getDriver: () => driver },
  };
  const card = { trigger: async () => {} };
  cam.driver = { _deviceSmartDetectionTrigger: card, _deviceSmartDetectionTriggerPerson: card, _deviceSmartDetectionEndedTrigger: card };
  cam._smartDetectZones = [{ id: 1, name: 'Driveway' }];
  cam.getName = () => 'Cam';
  cam.getData = () => ({ id: 'cam-1' });
  cam.setCapabilityValue = () => Promise.resolve();
  cam.error = (e) => { throw e; };

  cam.onSmartDetection({ smartDetectTypes: ['person'], start: 1, score: 60, metadata: { zonesStatus: { 1: { status: 'enter' } } } }, 'add', 'ev');
  assert.strictEqual(sensor.values.alarm_motion, true);
  cam.onSmartDetection({ smartDetectTypes: [], end: 9 }, 'update', 'ev');
  assert.strictEqual(sensor.values.alarm_motion, false);
  cam.onSmartDetection({ smartDetectTypes: ['person'], metadata: { zonesStatus: { 1: { status: 'enter' } } } }, 'update', 'ev');
  assert.strictEqual(sensor.values.alarm_motion, false, 'late frame after end does not re-open');
}

console.log('zone-sensor smoke: OK');
