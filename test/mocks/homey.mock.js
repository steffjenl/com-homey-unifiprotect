'use strict';

// Minimal stand-in for the `homey` SDK so driver/device classes can be required in unit tests.
module.exports = {
  SimpleClass: class SimpleClass {},
  App: class App {},
  Device: class Device {},
  Driver: class Driver {},
};
