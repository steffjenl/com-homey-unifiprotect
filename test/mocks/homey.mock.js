'use strict';

// Minimal stand-in for the `homey` SDK so driver/device classes can be required in unit tests.
const { EventEmitter } = require('events');

module.exports = {
  // The real SimpleClass is an EventEmitter (the API classes emit connection events).
  SimpleClass: class SimpleClass extends EventEmitter {},
  App: class App {},
  Device: class Device {},
  Driver: class Driver {},
};
