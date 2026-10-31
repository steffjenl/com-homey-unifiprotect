'use strict';

const C = require('../../library/constants');
const { GATE_BUTTONS, buttonsForMode, toggleCommand } = require('../../library/gate-control');
const GarageDoorDevice = require('../../drivers/access-garagedoor/device');

describe('gate-control helpers', () => {
  test('buttons per mode, in UniFi Access order (Open | Stop | Close)', () => {
    expect(buttonsForMode(C.GATE_MODE_THREE_BUTTON)).toEqual(['gate_open_button', 'gate_stop_button', 'gate_close_button']);
    expect(buttonsForMode(C.GATE_MODE_TWO_BUTTON)).toEqual(['gate_open_button', 'gate_close_button']);
    expect(buttonsForMode(C.GATE_MODE_SINGLE)).toEqual([]);
    expect(buttonsForMode(undefined)).toEqual([]); // devices paired before the setting existed
  });

  test('toggle maps the requested state to open/close in two- and three-button mode only', () => {
    for (const mode of [C.GATE_MODE_TWO_BUTTON, C.GATE_MODE_THREE_BUTTON]) {
      expect(toggleCommand(mode, true)).toBe('close');
      expect(toggleCommand(mode, false)).toBe('open');
    }
    expect(toggleCommand(C.GATE_MODE_SINGLE, true)).toBeNull();
    expect(toggleCommand(undefined, false)).toBeNull();
  });

  test('every button sends a documented control_cmd', () => {
    expect(Object.values(GATE_BUTTONS).sort()).toEqual(['close', 'open', 'stop']);
  });
});

function createDevice(mode) {
  const device = Object.create(GarageDoorDevice.prototype);
  device.settings = { [C.SETTING_GATE_CONTROL_MODE]: mode };
  device.caps = ['garagedoor_closed'];
  device.listeners = {};
  device.unlockCalls = [];
  device.getSetting = (key) => device.settings[key];
  device.getData = () => ({ id: 'gate-1' });
  device.getCapabilities = () => [...device.caps];
  device.hasCapability = (id) => device.caps.includes(id);
  device.addCapability = async (id) => {
    if (!device.caps.includes(id)) device.caps.push(id);
  };
  device.removeCapability = async (id) => {
    device.caps = device.caps.filter((c) => c !== id);
  };
  device.registerCapabilityListener = (id, fn) => {
    if (device.listeners[id]) throw new Error(`listener for ${id} registered twice`);
    device.listeners[id] = fn;
  };
  device.log = () => {};
  device.homey = {
    app: {
      accessApi: {
        setDoorUnLock: async (...args) => {
          device.unlockCalls.push(args);
          return { code: 'SUCCESS' };
        },
      },
    },
  };
  return device;
}

const changeMode = (device, mode) => device.onSettings({
  oldSettings: {}, newSettings: { [C.SETTING_GATE_CONTROL_MODE]: mode }, changedKeys: [C.SETTING_GATE_CONTROL_MODE],
});

describe('Access Garage door gate control mode', () => {
  test('three-button mode adds Open | Stop | Close and each sends its control_cmd', async () => {
    const device = createDevice(C.GATE_MODE_THREE_BUTTON);
    await device._applyGateMode(C.GATE_MODE_THREE_BUTTON);

    expect(device.caps).toEqual(['garagedoor_closed', 'gate_open_button', 'gate_stop_button', 'gate_close_button']);
    await device.listeners.gate_open_button(true);
    await device.listeners.gate_stop_button(true);
    await device.listeners.gate_close_button(true);
    expect(device.unlockCalls).toEqual([
      ['gate-1', undefined, 'open'],
      ['gate-1', undefined, 'stop'],
      ['gate-1', undefined, 'close'],
    ]);
  });

  test('two-button mode adds Open | Close only', async () => {
    const device = createDevice(C.GATE_MODE_TWO_BUTTON);
    await device._applyGateMode(C.GATE_MODE_TWO_BUTTON);
    expect(device.caps).toEqual(['garagedoor_closed', 'gate_open_button', 'gate_close_button']);
  });

  test('two → three buttons keeps the Open | Stop | Close order', async () => {
    const device = createDevice(C.GATE_MODE_TWO_BUTTON);
    await device._applyGateMode(C.GATE_MODE_TWO_BUTTON);
    await changeMode(device, C.GATE_MODE_THREE_BUTTON);
    expect(device.caps).toEqual(['garagedoor_closed', 'gate_open_button', 'gate_stop_button', 'gate_close_button']);
  });

  test('three → two → single, then back, without double-registering listeners', async () => {
    const device = createDevice(C.GATE_MODE_THREE_BUTTON);
    await device._applyGateMode(C.GATE_MODE_THREE_BUTTON);
    await changeMode(device, C.GATE_MODE_TWO_BUTTON);
    expect(device.caps).toEqual(['garagedoor_closed', 'gate_open_button', 'gate_close_button']);
    await changeMode(device, C.GATE_MODE_SINGLE);
    expect(device.caps).toEqual(['garagedoor_closed']);
    await expect(changeMode(device, C.GATE_MODE_THREE_BUTTON)).resolves.toBeUndefined();
    expect(device.caps).toEqual(['garagedoor_closed', 'gate_open_button', 'gate_stop_button', 'gate_close_button']);
  });

  test('applying the same mode again changes nothing', async () => {
    const device = createDevice(C.GATE_MODE_THREE_BUTTON);
    await device._applyGateMode(C.GATE_MODE_THREE_BUTTON);
    const removed = [];
    device.removeCapability = async (id) => removed.push(id);
    await device._applyGateMode(C.GATE_MODE_THREE_BUTTON);
    expect(removed).toEqual([]);
  });

  test('tile toggle: explicit open/close in two/three-button mode, plain pulse otherwise', async () => {
    for (const mode of [C.GATE_MODE_TWO_BUTTON, C.GATE_MODE_THREE_BUTTON]) {
      const device = createDevice(mode);
      await device._onGarageDoorToggle(false); // user asks for "open"
      await device._onGarageDoorToggle(true); // user asks for "closed"
      expect(device.unlockCalls).toEqual([['gate-1', undefined, 'open'], ['gate-1', undefined, 'close']]);
    }

    const single = createDevice(undefined);
    await single._onGarageDoorToggle(true);
    expect(single.unlockCalls).toEqual([['gate-1']]);
  });
});
