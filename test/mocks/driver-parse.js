'use strict';

// Creates a bare driver (no Homey runtime) and a recording fake device for
// onParseWebsocketMessage tests. `handlers` are the device methods the driver may call;
// `initialized: false` omits the `_events` marker the drivers use to detect a live device.
function createDriverHarness(Driver, handlers, { initialized = true } = {}) {
  const driver = Object.create(Driver.prototype);
  driver.log = () => {};
  driver.error = () => {};
  driver.homey = { app: { debug: () => {} } };

  const device = {};
  if (initialized) {
    device._events = {};
  }
  device.getName = () => 'Test Device';
  handlers.forEach((name) => {
    device[name] = jest.fn();
  });
  return { driver, device };
}

module.exports = { createDriverHarness };
