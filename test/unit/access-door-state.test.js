'use strict';

// Regression for GitHub issue #49: UA Gate Hub door state & duplicate events.

const {
  normalizeDoorState, DOOR_STATE_OPEN, DOOR_STATE_CLOSED, DOOR_STATE_UNKNOWN,
} = require('../../library/door-state');
const GarageDoorDevice = require('../../drivers/access-garagedoor/device');

function createDevice() {
  const device = Object.create(GarageDoorDevice.prototype);
  device._doorState = DOOR_STATE_UNKNOWN;
  device.triggerLog = [];
  device.capabilityLog = [];
  device.error = (err) => {
    throw err;
  };
  device.setCapabilityValue = async (id, value) => {
    device.capabilityLog.push([id, value]);
  };
  device.driver = {
    ready: async () => {},
    triggerGarageDoorOpened: () => device.triggerLog.push('opened'),
    triggerGarageDoorClosed: () => device.triggerLog.push('closed'),
  };
  return device;
}

describe('normalizeDoorState', () => {
  test.each([
    ['open', undefined, DOOR_STATE_OPEN],
    ['close', undefined, DOOR_STATE_CLOSED],
    ['closed', undefined, DOOR_STATE_CLOSED],
    ['none', undefined, DOOR_STATE_UNKNOWN],
    ['', undefined, DOOR_STATE_UNKNOWN],
    [undefined, undefined, DOOR_STATE_UNKNOWN],
    // Gate Hub without a wired door position sensor: dps_connected:false always wins
    ['open', false, DOOR_STATE_UNKNOWN],
  ])('%p (dps_connected=%p) -> %p', (raw, dpsConnected, expected) => {
    expect(normalizeDoorState(raw, dpsConnected)).toBe(expected);
  });
});

describe('garage door transitions', () => {
  test('first known reading sets the capability without a trigger', async () => {
    const device = createDevice();
    await device._applyDoorState(DOOR_STATE_CLOSED);
    expect(device.triggerLog).toHaveLength(0);
    expect(device.capabilityLog).toEqual([['garagedoor_closed', true]]);
  });

  test('unknown state is ignored', async () => {
    const device = createDevice();
    await device._applyDoorState(DOOR_STATE_UNKNOWN);
    expect(device.triggerLog).toHaveLength(0);
    expect(device.capabilityLog).toHaveLength(0);
    expect(device._doorState).toBe(DOOR_STATE_UNKNOWN);
  });

  test('exactly one trigger per real transition', async () => {
    const device = createDevice();
    await device._applyDoorState(DOOR_STATE_CLOSED); // baseline
    await device._applyDoorState(DOOR_STATE_OPEN); // -> opened
    await device._applyDoorState(DOOR_STATE_OPEN); // duplicate, must not re-fire
    await device._applyDoorState(DOOR_STATE_CLOSED); // -> closed
    expect(device.triggerLog).toEqual(['opened', 'closed']);
  });

  test('unknown reading between transitions does not block the next trigger', async () => {
    const device = createDevice();
    await device._applyDoorState(DOOR_STATE_CLOSED);
    await device._applyDoorState(DOOR_STATE_UNKNOWN);
    await device._applyDoorState(DOOR_STATE_OPEN);
    expect(device.triggerLog).toEqual(['opened']);
  });
});
