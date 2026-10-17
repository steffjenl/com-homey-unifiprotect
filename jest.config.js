'use strict';

module.exports = {
  testEnvironment: 'node',
  modulePathIgnorePatterns: ['<rootDir>/.homeybuild/'],
  testMatch: ['<rootDir>/test/**/*.test.js'],
  // App code requires the real `homey` SDK, which only exists on a Homey. Swap in stubs.
  moduleNameMapper: {
    '^homey$': '<rootDir>/test/mocks/homey.mock.js',
  },
};
