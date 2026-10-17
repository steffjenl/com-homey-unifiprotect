'use strict';

const NVRAlarmDevice = require('../../drivers/protect-nvr-alarm/device');
const NVRAlarmDriver = require('../../drivers/protect-nvr-alarm/driver');
const UfvConstants = require('../../library/constants');

function createDevice(initialState = 'disarmed') {
  const device = Object.create(NVRAlarmDevice.prototype);
  device.values = { homealarm_state: initialState, alarm_generic: false };
  device.triggers = []; // [cardId, tokens]
  device.errors = [];
  device.homey = { app: { debug: () => {} } };
  device.getCapabilityValue = (name) => device.values[name];
  device.setCapabilityValue = async (name, value) => {
    device.values[name] = value;
  };
  device.error = (e) => device.errors.push(e);
  device.driver = {
    homey: {
      flow: {
        getDeviceTriggerCard: (id) => ({
          trigger: async (dev, tokens) => {
            device.triggers.push([id, tokens]);
          },
        }),
      },
    },
  };
  return device;
}

const cardIds = (device) => device.triggers.map(([id]) => id);

describe('NVRAlarmDevice._toIsAway', () => {
  const device = createDevice();

  test.each([
    ['boolean true', true, true],
    ['boolean false', false, false],
    ['null', null, false],
    ['undefined', undefined, false],
    ['string', 'armed', false],
    ['status armed', { status: 'armed' }, true],
    ['status ARMED (case-insensitive)', { status: 'ARMED' }, true],
    ['status breach', { status: 'breach' }, true],
    ['status disarmed', { status: 'disarmed' }, false],
    ['status disabled', { status: 'disabled' }, false],
    ['unknown status', { status: 'whatever' }, false],
    ['isEnabled true', { isEnabled: true }, true],
    ['isEnabled false', { isEnabled: false }, false],
    ['isAway true', { isAway: true }, true],
    ['isAway false', { isAway: false }, false],
    ['empty object', {}, false],
    ['status wins over isEnabled', { status: 'disarmed', isEnabled: true }, false],
  ])('%s', (_label, input, expected) => {
    expect(device._toIsAway(input, 'test')).toBe(expected);
  });
});

describe('NVRAlarmDevice.onAlarmStateChanged', () => {
  test('arming from disarmed sets state and fires changed + armed', async () => {
    const device = createDevice('disarmed');
    await device.onAlarmStateChanged({ status: 'armed' });
    expect(device.values.homealarm_state).toBe('armed');
    expect(device.triggers).toEqual([
      [UfvConstants.EVENT_NVR_ALARM_STATE_CHANGED, { state: 'armed' }],
      [UfvConstants.EVENT_NVR_ALARM_ARMED, undefined],
    ]);
  });

  test('disarming clears alarm_generic and fires changed + disarmed', async () => {
    const device = createDevice('armed');
    device.values.alarm_generic = true;
    await device.onAlarmStateChanged({ status: 'disarmed' });
    expect(device.values).toMatchObject({ homealarm_state: 'disarmed', alarm_generic: false });
    expect(cardIds(device)).toEqual([UfvConstants.EVENT_NVR_ALARM_STATE_CHANGED, UfvConstants.EVENT_NVR_ALARM_DISARMED]);
  });

  test('same state again fires nothing (dedupe)', async () => {
    const device = createDevice('armed');
    await device.onAlarmStateChanged({ status: 'armed' });
    expect(device.triggers).toHaveLength(0);
  });

  test('legacy boolean isAway works', async () => {
    const device = createDevice('disarmed');
    await device.onAlarmStateChanged(true);
    expect(device.values.homealarm_state).toBe('armed');
  });

  test('breach keeps armed, sets alarm_generic and fires changed(breach) + breach', async () => {
    const device = createDevice('disarmed');
    await device.onAlarmStateChanged({ status: 'breach' });
    expect(device.values).toMatchObject({ homealarm_state: 'armed', alarm_generic: true });
    expect(device.triggers).toEqual([
      [UfvConstants.EVENT_NVR_ALARM_STATE_CHANGED, { state: 'breach' }],
      [UfvConstants.EVENT_NVR_ALARM_BREACH, undefined],
    ]);
  });

  test('disarm after breach resets alarm_generic', async () => {
    const device = createDevice('disarmed');
    await device.onAlarmStateChanged({ status: 'breach' });
    await device.onAlarmStateChanged({ status: 'disarmed' });
    expect(device.values).toMatchObject({ homealarm_state: 'disarmed', alarm_generic: false });
  });

  test('capability failure is reported, not thrown', async () => {
    const device = createDevice('disarmed');
    device.setCapabilityValue = async () => {
      throw new Error('nope');
    };
    await expect(device.onAlarmStateChanged(true)).resolves.toBeUndefined();
    expect(device.errors[0]).toContain('nope');
  });
});

describe('NVRAlarmDriver.onParseWebsocketMessage', () => {
  const driver = Object.create(NVRAlarmDriver.prototype);

  test('armMode takes precedence over isAway', () => {
    const device = { onAlarmStateChanged: jest.fn() };
    driver.onParseWebsocketMessage(device, { armMode: { status: 'armed' }, isAway: false });
    expect(device.onAlarmStateChanged).toHaveBeenCalledTimes(1);
    expect(device.onAlarmStateChanged).toHaveBeenCalledWith({ status: 'armed' });
  });

  test('legacy isAway is used when no armMode', () => {
    const device = { onAlarmStateChanged: jest.fn() };
    driver.onParseWebsocketMessage(device, { isAway: true });
    expect(device.onAlarmStateChanged).toHaveBeenCalledWith(true);
  });

  test.each([
    ['unrelated NVR update', { name: 'NVR' }],
    ['null', null],
    ['string', 'x'],
  ])('%s is ignored', (_label, payload) => {
    const device = { onAlarmStateChanged: jest.fn() };
    driver.onParseWebsocketMessage(device, payload);
    expect(device.onAlarmStateChanged).not.toHaveBeenCalled();
  });

  test('getNVRAlarmDevice returns first device or false', () => {
    const d = Object.create(NVRAlarmDriver.prototype);
    d.getDevices = () => [{ id: 1 }, { id: 2 }];
    expect(d.getNVRAlarmDevice()).toEqual({ id: 1 });
    d.getDevices = () => [];
    expect(d.getNVRAlarmDevice()).toBe(false);
    d.getDevices = () => {
      throw new Error('x');
    };
    expect(d.getNVRAlarmDevice()).toBe(false);
  });
});
