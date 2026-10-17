'use strict';

const Sensor = require('../../drivers/protectsensor/device');

// Built on Sensor.prototype (via Object.create) so private helpers (e.g. _ensureCapability)
// resolve through the prototype chain, while the Homey.Device primitives are faked here.
function createFakeSensorDevice() {
  const device = Object.create(Sensor.prototype);
  device.capabilities = new Set(['alarm_contact']);
  device.capabilityValues = {};
  device.homey = {
    app: { debug: () => {} },
    setTimeout: () => -1,
    clearTimeout: () => {},
  };

  device.hasCapability = (name) => device.capabilities.has(name);
  device.addCapability = async (name) => {
    device.capabilities.add(name);
  };
  device.removeCapability = async (name) => {
    device.capabilities.delete(name);
  };
  device.setCapabilityValue = (name, value) => {
    device.capabilityValues[name] = value;
    return Promise.resolve();
  };
  device.getName = () => 'Test Sensor';
  device.getData = () => ({ id: 'sensor-1' });
  device.error = (err) => {
    throw err;
  };

  return device;
}

function createFakeBootstrapDevice(sensor) {
  const device = createFakeSensorDevice();
  device.getData = () => ({ id: sensor.id });
  device.getClass = () => 'sensor';
  device.setClass = async () => {};
  device.homey.app.api = { getBootstrap: () => ({ sensors: [sensor] }) };
  return device;
}

module.exports = { createFakeSensorDevice, createFakeBootstrapDevice };
