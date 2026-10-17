'use strict';

// "smart detection ended" trigger (library/SmartDetectionMixin.js): one ended trigger per event
// id (Protect repeats the closing frame), none for an event that never got types, none for
// audio events, and types survive an empty closing frame.

const { createSmartDetectionDevice } = require('../mocks/fake-smart-detection-device');

function create() {
  const fired = { app: [], device: [] };
  const device = createSmartDetectionDevice({
    appCards: {
      _smartDetectionEndedTrigger: {
        trigger: async (t) => {
          fired.app.push(t);
        },
      },
    },
    driverCards: {
      _deviceSmartDetectionEndedTrigger: {
        trigger: async (d, t) => {
          fired.device.push(t);
        },
      },
    },
  });
  return { device, fired };
}

describe('smart detection ended trigger', () => {
  test('fires once per event with type, duration and score', () => {
    const { device, fired } = create();
    device.onSmartDetection({ smartDetectTypes: [], start: 1000 }, 'add', 'e1');
    device.onSmartDetection({ smartDetectTypes: ['person'], score: 80 }, 'update', 'e1');
    device.onSmartDetection({ smartDetectTypes: [], end: 13000 }, 'update', 'e1'); // empty types must not wipe
    device.onSmartDetection({ smartDetectTypes: ['person'], end: 13000 }, 'update', 'e1');
    device.onSmartDetectionEnd({ end: 13000 }, 'e1');

    expect(fired.app).toHaveLength(1);
    expect(fired.device).toHaveLength(1);
    expect(fired.app[0]).toMatchObject({ smart_detection_type: 'person', duration: 12, score: 80 });
  });

  test('event that never received types does not fire', () => {
    const { device, fired } = create();
    device.onSmartDetection({ smartDetectTypes: [], start: 1000 }, 'add', 'e2');
    device.onSmartDetection({ smartDetectTypes: [], end: 2000 }, 'update', 'e2');
    expect(fired.app).toHaveLength(0);
  });

  test('unknown event id is ignored', () => {
    const { device, fired } = create();
    device.onSmartDetectionEnd({ end: 2000 }, 'nope');
    expect(fired.app).toHaveLength(0);
  });

  test('audio event end frame does not fire the smart ended trigger', () => {
    const { device, fired } = create();
    device.homey.app._audioDetectionTrigger = { trigger: async () => {} };
    device.driver._deviceAudioDetectionTrigger = { trigger: async () => {} };
    device.onAudioDetection({ smartDetectTypes: ['alrmSmoke'], start: 1000, score: 50 }, 'add', 'a1');
    device.onSmartDetectionEnd({ end: 2000 }, 'a1');
    expect(fired.app).toHaveLength(0);
  });
});
