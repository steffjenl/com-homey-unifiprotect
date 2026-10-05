'use strict';

// Smoke test for the zone argument on device smart detection triggers
// (library/smart-detection-zone.js + zone ids passed as trigger state by SmartDetectionMixin).

const assert = require('assert');
const { matchesZone, listZones } = require('../library/smart-detection-zone');
const SmartDetectionMixin = require('../library/SmartDetectionMixin');

// matchesZone
assert.strictEqual(matchesZone({}, { zone_ids: ['1'] }), true, 'legacy flow without zone arg matches');
assert.strictEqual(matchesZone({ zone: { id: 'any' } }, { zone_ids: [] }), true, 'any matches');
assert.strictEqual(matchesZone({ zone: { id: '2' } }, { zone_ids: ['1', '2'] }), true);
assert.strictEqual(matchesZone({ zone: { id: 2 } }, { zone_ids: ['2'] }), true, 'string/number ids compare equal');
assert.strictEqual(matchesZone({ zone: { id: '3' } }, { zone_ids: ['1', '2'] }), false);
assert.strictEqual(matchesZone({ zone: { id: '1' } }, {}), false, 'no zone info (V2) never matches a specific zone');

// listZones
const homey = { __: () => 'Any zone' };
const device = { _smartDetectZones: [{ id: 1, name: 'Driveway' }, { id: 2, name: 'Street' }] };
assert.deepStrictEqual(listZones(homey, device, '').map((z) => z.name), ['Any zone', 'Driveway', 'Street']);
assert.deepStrictEqual(listZones(homey, device, 'drive').map((z) => z.id), ['1']);
assert.deepStrictEqual(listZones(homey, {}, '').map((z) => z.id), ['any']);

// Mixin passes zone ids as trigger state and keeps them for the ended trigger
const states = [];
const device2 = Object.assign({}, SmartDetectionMixin);
device2.homey = {
  app: {
    debug: () => {},
    getUnixTimestamp: () => Date.now(),
    toLocalTime: (d) => d,
    isV1Available: () => false,
    _smartDetectionTrigger: { trigger: async () => {} },
    _smartDetectionTriggerPerson: { trigger: async () => {} },
    _smartDetectionEndedTrigger: { trigger: async () => {} },
  },
};
const card = { trigger: async (d, t, state) => { states.push(state); } };
device2.driver = {
  _deviceSmartDetectionTrigger: card,
  _deviceSmartDetectionTriggerPerson: card,
  _deviceSmartDetectionEndedTrigger: card,
};
device2._smartDetectZones = [{ id: 1, name: 'Driveway' }, { id: 2, name: 'Street' }];
device2.getName = () => 'Cam';
device2.getData = () => ({ id: 'cam-1' });
device2.setCapabilityValue = () => Promise.resolve();
device2.error = (e) => { throw e; };

device2.onSmartDetection({ smartDetectTypes: ['person'], start: 1000, score: 70, metadata: { zonesStatus: { 1: { status: 'enter' }, 2: { status: 'none' } } } }, 'add', 'e1');
device2.onSmartDetection({ smartDetectTypes: [], end: 5000 }, 'update', 'e1'); // no metadata on closing frame
assert.deepStrictEqual(states[0], { zone_ids: ['1'] });
assert.deepStrictEqual(states[states.length - 1], { zone_ids: ['1'] }, 'ended trigger keeps zone ids');

console.log('smart-detection-zone smoke: OK');
