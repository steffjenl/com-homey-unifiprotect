'use strict';

// Smoke test for the "smart detection ended" trigger (library/SmartDetectionMixin.js).
// Verifies: one ended trigger per event id (Protect repeats the closing frame), no ended for an
// event that never got types, no ended for audio events, types survive an empty closing frame.

const assert = require('assert');
const SmartDetectionMixin = require('../library/SmartDetectionMixin');

function createFakeDevice() {
  const fired = { app: [], device: [] };
  const device = Object.assign({}, SmartDetectionMixin);
  device.homey = {
    app: {
      debug: () => {},
      getUnixTimestamp: () => Date.now(),
      toLocalTime: (d) => d,
      isV1Available: () => false,
      _smartDetectionEndedTrigger: { trigger: async (t) => { fired.app.push(t); } },
      _smartDetectionTrigger: { trigger: async () => {} },
      _smartDetectionTriggerPerson: { trigger: async () => {} },
    },
  };
  device.driver = {
    _deviceSmartDetectionEndedTrigger: { trigger: async (d, t) => { fired.device.push(t); } },
    _deviceSmartDetectionTrigger: { trigger: async () => {} },
    _deviceSmartDetectionTriggerPerson: { trigger: async () => {} },
  };
  device.getName = () => 'Test Camera';
  device.getData = () => ({ id: 'cam-1' });
  device.setCapabilityValue = () => Promise.resolve();
  device.error = (err) => { throw err; };
  return { device, fired };
}

// Normal flow: add (no types) -> update (types) -> closing frame x3
{
  const { device, fired } = createFakeDevice();
  device.onSmartDetection({ smartDetectTypes: [], start: 1000 }, 'add', 'e1');
  device.onSmartDetection({ smartDetectTypes: ['person'], score: 80 }, 'update', 'e1');
  device.onSmartDetection({ smartDetectTypes: [], end: 13000 }, 'update', 'e1'); // empty types must not wipe
  device.onSmartDetection({ smartDetectTypes: ['person'], end: 13000 }, 'update', 'e1');
  device.onSmartDetectionEnd({ end: 13000 }, 'e1');
  assert.strictEqual(fired.app.length, 1, 'app ended trigger fires once');
  assert.strictEqual(fired.device.length, 1, 'device ended trigger fires once');
  assert.strictEqual(fired.app[0].smart_detection_type, 'person');
  assert.strictEqual(fired.app[0].duration, 12);
  assert.strictEqual(fired.app[0].score, 80);
}

// Event that never received types: no ended trigger
{
  const { device, fired } = createFakeDevice();
  device.onSmartDetection({ smartDetectTypes: [], start: 1000 }, 'add', 'e2');
  device.onSmartDetection({ smartDetectTypes: [], end: 2000 }, 'update', 'e2');
  assert.strictEqual(fired.app.length, 0);
}

// Unknown id (e.g. motion end frame): ignored
{
  const { device, fired } = createFakeDevice();
  device.onSmartDetectionEnd({ end: 2000 }, 'nope');
  assert.strictEqual(fired.app.length, 0);
}

// Audio event end frame must not fire the smart ended trigger
{
  const { device, fired } = createFakeDevice();
  device.homey.app._audioDetectionTrigger = { trigger: async () => {} };
  device.driver._deviceAudioDetectionTrigger = { trigger: async () => {} };
  device.onAudioDetection({ smartDetectTypes: ['alrmSmoke'], start: 1000, score: 50 }, 'add', 'a1');
  device.onSmartDetectionEnd({ end: 2000 }, 'a1');
  assert.strictEqual(fired.app.length, 0);
}

console.log('smart-detection-ended smoke: OK');
