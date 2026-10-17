'use strict';

const SmartDetectionMixin = require('../../library/SmartDetectionMixin');

const noop = { trigger: async () => {} };

// Camera-like device built on SmartDetectionMixin. `appCards` / `driverCards` override the
// default no-op trigger cards (keyed by property name, e.g. `_smartDetectionEndedTrigger`);
// `homey` is merged into the fake homey object.
function createSmartDetectionDevice({ appCards = {}, driverCards = {}, homey = {} } = {}) {
  const device = { ...SmartDetectionMixin };
  device.homey = {
    app: {
      debug: () => {},
      getUnixTimestamp: () => Date.now(),
      toLocalTime: (d) => d,
      isV1Available: () => false,
      _smartDetectionTrigger: noop,
      _smartDetectionTriggerPerson: noop,
      _smartDetectionEndedTrigger: noop,
      ...appCards,
    },
    ...homey,
  };
  device.driver = {
    _deviceSmartDetectionTrigger: noop,
    _deviceSmartDetectionTriggerPerson: noop,
    _deviceSmartDetectionEndedTrigger: noop,
    ...driverCards,
  };
  device.getName = () => 'Cam';
  device.getData = () => ({ id: 'cam-1' });
  device.setCapabilityValue = () => Promise.resolve();
  device.error = (err) => {
    throw err;
  };
  return device;
}

module.exports = { createSmartDetectionDevice, noop };
