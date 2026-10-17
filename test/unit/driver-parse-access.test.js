'use strict';

const DoorDriver = require('../../drivers/access-door/driver');
const GarageDoorDriver = require('../../drivers/access-garagedoor/driver');
const HubDriver = require('../../drivers/access-hub/driver');
const ReaderDriver = require('../../drivers/access-reader/driver');
const IntercomDriver = require('../../drivers/access-intercom/driver');
const { createDriverHarness } = require('../mocks/driver-parse');

describe.each([
  ['access-door', DoorDriver],
  ['access-garagedoor', GarageDoorDriver],
  ['access-intercom', IntercomDriver],
])('%s lock + door position', (_name, Driver) => {
  const handlers = ['onLockChange', 'onDoorChange'];

  test.each([
    ['locked', true],
    ['unlocked', false],
  ])('lock=%s -> onLockChange(%s)', (lock, expected) => {
    const { driver, device } = createDriverHarness(Driver, handlers);
    driver.onParseWebsocketMessage(device, { state: { lock } });
    expect(device.onLockChange).toHaveBeenCalledWith(expected);
  });

  test('dps is passed with dps_connected', () => {
    const { driver, device } = createDriverHarness(Driver, handlers);
    driver.onParseWebsocketMessage(device, { state: { dps: 'open', dps_connected: true } });
    expect(device.onDoorChange).toHaveBeenCalledWith('open', true);
  });

  test('payload without state is ignored', () => {
    const { driver, device } = createDriverHarness(Driver, handlers);
    driver.onParseWebsocketMessage(device, { name: 'x' });
    expect(device.onLockChange).not.toHaveBeenCalled();
    expect(device.onDoorChange).not.toHaveBeenCalled();
  });

  test('uninitialized device is ignored', () => {
    const { driver, device } = createDriverHarness(Driver, handlers, { initialized: false });
    driver.onParseWebsocketMessage(device, { state: { lock: 'locked' } });
    expect(device.onLockChange).not.toHaveBeenCalled();
  });
});

describe('access-hub', () => {
  test('first location state lock is dispatched', () => {
    const { driver, device } = createDriverHarness(HubDriver, ['onLocationLockChange']);
    driver.onParseWebsocketMessage(device, { location_states: [{ lock: 'locked' }, { lock: 'unlocked' }] });
    expect(device.onLocationLockChange).toHaveBeenCalledTimes(1);
    expect(device.onLocationLockChange).toHaveBeenCalledWith(true);
  });

  test.each([
    ['empty array', { location_states: [] }],
    ['not an array', { location_states: 'x' }],
    ['no lock key', { location_states: [{ other: 1 }] }],
    ['missing', {}],
  ])('%s is ignored', (_label, payload) => {
    const { driver, device } = createDriverHarness(HubDriver, ['onLocationLockChange']);
    driver.onParseWebsocketMessage(device, payload);
    expect(device.onLocationLockChange).not.toHaveBeenCalled();
  });
});

describe('access-reader access methods', () => {
  const handlers = ['onNfcConfigChange', 'onWaveConfigChange', 'onMobileButtonConfigChange', 'onMobileTapConfigChange', 'onTouchPassConfigChange'];

  test.each([
    ['nfc', 'onNfcConfigChange'],
    ['wave', 'onWaveConfigChange'],
    ['bt_button', 'onMobileButtonConfigChange'],
    ['bt_tap', 'onMobileTapConfigChange'],
    ['touch_pass', 'onTouchPassConfigChange'],
  ])('%s yes/no maps to boolean', (key, handler) => {
    const { driver, device } = createDriverHarness(ReaderDriver, handlers);
    driver.onParseWebsocketMessage(device, { access_method: { [key]: 'yes' } });
    expect(device[handler]).toHaveBeenLastCalledWith(true);
    driver.onParseWebsocketMessage(device, { access_method: { [key]: 'no' } });
    expect(device[handler]).toHaveBeenLastCalledWith(false);
  });

  // KNOWN BUG (test/KNOWN_ISSUES.md #2): the apple_pass branch reads access_method.touch_pass
  // (copy/paste) instead of apple_pass, so an apple_pass-only update reports "no".
  // test.failing passes while the bug exists and starts failing once it is fixed.
  test.failing('apple_pass-only update reports its own value', () => {
    const { driver, device } = createDriverHarness(ReaderDriver, handlers);
    driver.onParseWebsocketMessage(device, { access_method: { apple_pass: 'yes' } });
    expect(device.onTouchPassConfigChange).toHaveBeenLastCalledWith(true);
  });

  test('payload without access_method is ignored', () => {
    const { driver, device } = createDriverHarness(ReaderDriver, handlers);
    driver.onParseWebsocketMessage(device, { name: 'x' });
    handlers.forEach((h) => expect(device[h]).not.toHaveBeenCalled());
  });
});
