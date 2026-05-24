'use strict';

const Module = require('module');
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'homey') {
    return {
      SimpleClass: class SimpleClass {},
      App: class App {},
      Device: class Device {},
      Driver: class Driver {},
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const FobHandler = require('../library/fob-handler');
const FobActionMapper = require('../library/action-mapper');

function createMockHomey() {
  return {
    app: {
      debug: () => {},
      api: {
        getBootstrap: () => ({ speakers: [{ id: 'speaker-1' }] }),
      },
    },
    error: () => {},
  };
}

async function run() {
  const homey = createMockHomey();

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

  const event = fobHandler.parseWebsocketPacket(samplePacket);
  if (!event) {
    throw new Error('Expected normalized FOB event');
  }

  await actionMapper.handleEvent(event);

  // Duplicate packet should be ignored by idempotency window.
  const duplicate = fobHandler.parseWebsocketPacket(samplePacket);
  if (duplicate) {
    throw new Error('Expected duplicate packet to be ignored');
  }

  if (calls.length === 0) {
    throw new Error('Expected mapped actions to run');
  }

  // eslint-disable-next-line no-console
  console.log('FOB pipeline smoke test passed', JSON.stringify(calls));
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});


