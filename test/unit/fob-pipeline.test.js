'use strict';

const FobHandler = require('../../library/fob-handler');
const FobActionMapper = require('../../library/action-mapper');

const homey = {
  app: {
    debug: () => {},
    api: { getBootstrap: () => ({ speakers: [{ id: 'speaker-1' }] }) },
  },
  error: () => {},
};

const samplePacket = {
  action: { action: 'add', modelKey: 'event', id: 'evt-1' },
  payload: {
    type: 'sensorButtonPressed',
    start: 1779653018028,
    metadata: {
      deviceModelKey: 'fob',
      button: { text: 'panic' },
      buttonPressType: { text: 'doublePress' },
    },
    device: 'fob-1',
  },
};

test('fob packet is normalized, mapped to actions, and duplicates are ignored', async () => {
  const fobHandler = new FobHandler({ dedupeWindowMs: 2000 });
  fobHandler.setHomeyObject(homey);

  const calls = [];
  const actionMapper = new FobActionMapper({
    setArmMode: async (mode) => calls.push(['setArmMode', mode]),
    triggerAlarm: async (context) => calls.push(['triggerAlarm', context]),
    customAction: async (actionId) => calls.push(['customAction', actionId]),
    sendSpeakerMessage: async (message, options) => calls.push(['speaker', message, options || {}]),
  });
  actionMapper.setHomeyObject(homey);

  const event = fobHandler.parseWebsocketPacket(samplePacket);
  expect(event).toBeTruthy();

  await actionMapper.handleEvent(event);
  expect(calls.length).toBeGreaterThan(0);

  // Duplicate packet is ignored by the idempotency window.
  expect(fobHandler.parseWebsocketPacket(samplePacket)).toBeFalsy();
});
