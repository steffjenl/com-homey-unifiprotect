'use strict';

// Regression test for GitHub issue #49: UA Gate Hub door state & duplicate events.
// Exercises normalizeDoorState() and the access-garagedoor device's transition logic
// without needing real Homey/Access hardware.

const assert = require('assert');
const Module = require('module');
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'homey') {
    return {
      Device: class Device {},
      Driver: class Driver {},
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const { normalizeDoorState, DOOR_STATE_OPEN, DOOR_STATE_CLOSED, DOOR_STATE_UNKNOWN } = require('../library/door-state');
const GarageDoorDevice = require('../drivers/access-garagedoor/device');

function testNormalizeDoorState() {
  assert.strictEqual(normalizeDoorState('open'), DOOR_STATE_OPEN);
  assert.strictEqual(normalizeDoorState('close'), DOOR_STATE_CLOSED);
  assert.strictEqual(normalizeDoorState('closed'), DOOR_STATE_CLOSED);
  assert.strictEqual(normalizeDoorState('none'), DOOR_STATE_UNKNOWN);
  assert.strictEqual(normalizeDoorState(''), DOOR_STATE_UNKNOWN);
  assert.strictEqual(normalizeDoorState(undefined), DOOR_STATE_UNKNOWN);
  // A Gate Hub without a wired door position sensor: dps_connected:false always wins,
  // even if some stray 'open'/'close' value is also present.
  assert.strictEqual(normalizeDoorState('open', false), DOOR_STATE_UNKNOWN);
  console.log('normalizeDoorState: OK');
}

function createDevice() {
  const device = Object.create(GarageDoorDevice.prototype);
  device._doorState = DOOR_STATE_UNKNOWN;
  device.triggerLog = [];
  device.capabilityLog = [];
  device.error = (err) => { throw err; };
  device.setCapabilityValue = async (id, value) => { device.capabilityLog.push([id, value]); };
  device.driver = {
    ready: async () => {},
    triggerGarageDoorOpened: () => device.triggerLog.push('opened'),
    triggerGarageDoorClosed: () => device.triggerLog.push('closed'),
  };
  return device;
}

async function testNoTriggerOnFirstKnownReading() {
  const device = createDevice();
  await device._applyDoorState(DOOR_STATE_CLOSED);
  assert.strictEqual(device.triggerLog.length, 0, 'first known reading must not fire a trigger');
  assert.deepStrictEqual(device.capabilityLog, [['garagedoor_closed', true]]);
  console.log('no trigger on first known reading: OK');
}

async function testUnknownIsIgnored() {
  const device = createDevice();
  await device._applyDoorState(DOOR_STATE_UNKNOWN);
  assert.strictEqual(device.triggerLog.length, 0);
  assert.strictEqual(device.capabilityLog.length, 0, 'unknown state must not touch the capability');
  assert.strictEqual(device._doorState, DOOR_STATE_UNKNOWN);
  console.log('unknown state ignored: OK');
}

async function testOneTriggerPerTransition() {
  const device = createDevice();
  await device._applyDoorState(DOOR_STATE_CLOSED); // baseline, no trigger
  await device._applyDoorState(DOOR_STATE_OPEN); // real transition -> opened
  await device._applyDoorState(DOOR_STATE_OPEN); // duplicate event -> must not re-fire
  await device._applyDoorState(DOOR_STATE_CLOSED); // real transition -> closed
  assert.deepStrictEqual(device.triggerLog, ['opened', 'closed']);
  console.log('exactly one trigger per real transition: OK');
}

async function testUnknownBetweenTransitionsDoesNotSuppressNextTrigger() {
  const device = createDevice();
  await device._applyDoorState(DOOR_STATE_CLOSED);
  await device._applyDoorState(DOOR_STATE_UNKNOWN); // e.g. a poll while the sensor is briefly unavailable
  await device._applyDoorState(DOOR_STATE_OPEN);
  assert.deepStrictEqual(device.triggerLog, ['opened']);
  console.log('unknown reading between transitions does not block the next trigger: OK');
}

async function run() {
  testNormalizeDoorState();
  await testNoTriggerOnFirstKnownReading();
  await testUnknownIsIgnored();
  await testOneTriggerPerTransition();
  await testUnknownBetweenTransitionsDoesNotSuppressNextTrigger();
  console.log('\nAll access door state checks passed.');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
