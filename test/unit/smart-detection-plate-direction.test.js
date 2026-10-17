'use strict';

// License plate text arriving on a later frame, plate flush on end, direction token.

const { createSmartDetectionDevice, noop } = require('../mocks/fake-smart-detection-device');

function create() {
  const calls = { plate: [], generic: [], ended: [] };
  const record = (list) => ({
    trigger: async (t) => {
      list.push(t);
    },
  });
  const device = createSmartDetectionDevice({
    appCards: {
      _smartDetectionTrigger: record(calls.generic),
      _smartDetectionTriggerLicensePlate: record(calls.plate),
      _smartDetectionEndedTrigger: record(calls.ended),
    },
    driverCards: { _deviceSmartDetectionTriggerLicensePlate: noop },
    homey: {
      drivers: {
        getDriver: () => {
          throw new Error('no zone sensor driver');
        },
      },
    },
  });
  return { device, calls };
}

const plateFrame = { smartDetectTypes: ['licensePlate'], metadata: { licensePlate: { name: 'AB-123-C' } } };

describe('license plate and direction', () => {
  test('plate text on a later frame fires once, with the text', () => {
    const { device, calls } = create();
    device.onSmartDetection({ smartDetectTypes: ['licensePlate'], start: 1, score: 90 }, 'add', 'p1');
    expect(calls.plate).toHaveLength(0); // waits for plate text

    device.onSmartDetection(plateFrame, 'update', 'p1');
    device.onSmartDetection(plateFrame, 'update', 'p1');
    expect(calls.plate).toHaveLength(1);
    expect(calls.plate[0].license_plate).toBe('AB-123-C');

    device.onSmartDetection({ smartDetectTypes: [], end: 9 }, 'update', 'p1');
    expect(calls.plate).toHaveLength(1); // no second plate trigger on end
  });

  test('plate never read is flushed once on end with empty text', () => {
    const { device, calls } = create();
    device.onSmartDetection({ smartDetectTypes: ['licensePlate'], start: 1, score: 90 }, 'add', 'p2');
    device.onSmartDetection({ smartDetectTypes: [], end: 9 }, 'update', 'p2');
    device.onSmartDetection({ smartDetectTypes: [], end: 9 }, 'update', 'p2');
    expect(calls.plate).toHaveLength(1);
    expect(calls.plate[0].license_plate).toBe('');
    expect(calls.ended).toHaveLength(1);
  });

  test('direction token appears on generic + ended triggers, kept after frames without it', () => {
    const { device, calls } = create();
    device.onSmartDetection({
      smartDetectTypes: ['person'], start: 1, score: 50, metadata: { direction: 'enter' },
    }, 'add', 'd1');
    expect(calls.generic[0].direction).toBe('enter');
    device.onSmartDetection({ smartDetectTypes: [], end: 9 }, 'update', 'd1');
    expect(calls.ended[0].direction).toBe('enter');
  });

  test('missing direction is an empty string, not undefined', () => {
    const { device, calls } = create();
    device.onSmartDetection({ smartDetectTypes: ['person'], start: 1, score: 50 }, 'add', 'd2');
    expect(calls.generic[0].direction).toBe('');
  });
});
