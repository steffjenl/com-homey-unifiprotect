'use strict';

// Smoke test: license plate text arriving on a later frame, plate flush on end, direction token.

const assert = require('assert');
const SmartDetectionMixin = require('../library/SmartDetectionMixin');

function create() {
  const calls = { plate: [], generic: [], ended: [] };
  const device = { ...SmartDetectionMixin };
  const noop = { trigger: async () => {} };
  device.homey = {
    app: {
      debug: () => {},
      getUnixTimestamp: () => Date.now(),
      toLocalTime: (d) => d,
      isV1Available: () => false,
      _smartDetectionTrigger: {
        trigger: async (t) => {
          calls.generic.push(t);
        },
      },
      _smartDetectionTriggerPerson: noop,
      _smartDetectionTriggerLicensePlate: {
        trigger: async (t) => {
          calls.plate.push(t);
        },
      },
      _smartDetectionEndedTrigger: {
        trigger: async (t) => {
          calls.ended.push(t);
        },
      },
    },
    drivers: {
      getDriver: () => {
        throw new Error('no zone sensor driver');
      },
    },
  };
  device.driver = {
    _deviceSmartDetectionTrigger: noop,
    _deviceSmartDetectionTriggerPerson: noop,
    _deviceSmartDetectionTriggerLicensePlate: noop,
    _deviceSmartDetectionEndedTrigger: noop,
  };
  device.getName = () => 'Cam';
  device.getData = () => ({ id: 'cam-1' });
  device.setCapabilityValue = () => Promise.resolve();
  device.error = (e) => {
    throw e;
  };
  return { device, calls };
}

// Plate text on a later frame: fires once, with the text
{
  const { device, calls } = create();
  device.onSmartDetection({ smartDetectTypes: ['licensePlate'], start: 1, score: 90 }, 'add', 'p1');
  assert.strictEqual(calls.plate.length, 0, 'waits for plate text');
  device.onSmartDetection({ smartDetectTypes: ['licensePlate'], metadata: { licensePlate: { name: 'AB-123-C' } } }, 'update', 'p1');
  device.onSmartDetection({ smartDetectTypes: ['licensePlate'], metadata: { licensePlate: { name: 'AB-123-C' } } }, 'update', 'p1');
  assert.strictEqual(calls.plate.length, 1);
  assert.strictEqual(calls.plate[0].license_plate, 'AB-123-C');
  device.onSmartDetection({ smartDetectTypes: [], end: 9 }, 'update', 'p1');
  assert.strictEqual(calls.plate.length, 1, 'no second plate trigger on end');
}

// Plate never read: flushed once on end with empty text
{
  const { device, calls } = create();
  device.onSmartDetection({ smartDetectTypes: ['licensePlate'], start: 1, score: 90 }, 'add', 'p2');
  device.onSmartDetection({ smartDetectTypes: [], end: 9 }, 'update', 'p2');
  device.onSmartDetection({ smartDetectTypes: [], end: 9 }, 'update', 'p2');
  assert.strictEqual(calls.plate.length, 1);
  assert.strictEqual(calls.plate[0].license_plate, '');
  assert.strictEqual(calls.ended.length, 1);
}

// Direction token (from metadata.direction) on generic + ended triggers, kept after frames without it
{
  const { device, calls } = create();
  device.onSmartDetection({
    smartDetectTypes: ['person'], start: 1, score: 50, metadata: { direction: 'enter' },
  }, 'add', 'd1');
  assert.strictEqual(calls.generic[0].direction, 'enter');
  device.onSmartDetection({ smartDetectTypes: [], end: 9 }, 'update', 'd1');
  assert.strictEqual(calls.ended[0].direction, 'enter');
}

// No direction available: empty string, not undefined
{
  const { device, calls } = create();
  device.onSmartDetection({ smartDetectTypes: ['person'], start: 1, score: 50 }, 'add', 'd2');
  assert.strictEqual(calls.generic[0].direction, '');
}

console.log('smart-detection-plate-direction smoke: OK');
