'use strict';

// Zone argument on device smart detection triggers (library/smart-detection-zone.js +
// zone ids passed as trigger state by SmartDetectionMixin).

const { matchesZone, listZones } = require('../../library/smart-detection-zone');
const { createSmartDetectionDevice } = require('../mocks/fake-smart-detection-device');

describe('matchesZone', () => {
  test.each([
    ['legacy flow without zone arg', {}, { zone_ids: ['1'] }, true],
    ['"any" zone', { zone: { id: 'any' } }, { zone_ids: [] }, true],
    ['listed zone', { zone: { id: '2' } }, { zone_ids: ['1', '2'] }, true],
    ['string/number ids compare equal', { zone: { id: 2 } }, { zone_ids: ['2'] }, true],
    ['unlisted zone', { zone: { id: '3' } }, { zone_ids: ['1', '2'] }, false],
    ['no zone info (V2) never matches a specific zone', { zone: { id: '1' } }, {}, false],
  ])('%s', (_label, args, state, expected) => {
    expect(matchesZone(args, state)).toBe(expected);
  });
});

describe('listZones', () => {
  const homey = { __: () => 'Any zone' };
  const device = { _smartDetectZones: [{ id: 1, name: 'Driveway' }, { id: 2, name: 'Street' }] };

  test('lists any + all zones', () => {
    expect(listZones(homey, device, '').map((z) => z.name)).toEqual(['Any zone', 'Driveway', 'Street']);
  });

  test('filters by query', () => {
    expect(listZones(homey, device, 'drive').map((z) => z.id)).toEqual(['1']);
  });

  test('device without zones only offers any', () => {
    expect(listZones(homey, {}, '').map((z) => z.id)).toEqual(['any']);
  });
});

test('mixin passes zone ids as trigger state and keeps them for the ended trigger', () => {
  const states = [];
  const card = {
    trigger: async (d, t, state) => {
      states.push(state);
    },
  };
  const device = createSmartDetectionDevice({
    driverCards: {
      _deviceSmartDetectionTrigger: card,
      _deviceSmartDetectionTriggerPerson: card,
      _deviceSmartDetectionEndedTrigger: card,
    },
  });
  device._smartDetectZones = [{ id: 1, name: 'Driveway' }, { id: 2, name: 'Street' }];

  device.onSmartDetection({
    smartDetectTypes: ['person'], start: 1000, score: 70, metadata: { zonesStatus: { 1: { status: 'enter' }, 2: { status: 'none' } } },
  }, 'add', 'e1');
  device.onSmartDetection({ smartDetectTypes: [], end: 5000 }, 'update', 'e1'); // no metadata on closing frame

  expect(states[0]).toEqual({ zone_ids: ['1'] });
  expect(states[states.length - 1]).toEqual({ zone_ids: ['1'] });
});
