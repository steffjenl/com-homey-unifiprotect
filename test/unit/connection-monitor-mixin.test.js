'use strict';

const { EventEmitter } = require('events');
const ConnectionMonitorMixin = require('../../library/ConnectionMonitorMixin');

function createDevice(homey) {
  return {
    ...ConnectionMonitorMixin,
    homey,
    error: jest.fn(),
    setAvailable: jest.fn(),
    setUnavailable: jest.fn(),
  };
}

describe('ConnectionMonitorMixin', () => {
  let apiV2;
  let homey;

  beforeEach(() => {
    jest.useFakeTimers();
    apiV2 = new EventEmitter();
    homey = {
      app: { apiV2, debug: () => {} },
      __: (key) => key,
      setTimeout: (fn, ms) => setTimeout(fn, ms),
      clearTimeout: (id) => clearTimeout(id),
    };
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('stopping one device keeps the listeners of other devices and the app', () => {
    const appListener = jest.fn();
    apiV2.on('protectv2-connection-change', appListener);
    const first = createDevice(homey);
    const second = createDevice(homey);
    first._startConnectionMonitoring('v2');
    second._startConnectionMonitoring('v2');

    first._stopConnectionMonitoring('v2');
    apiV2.emit('protectv2-connection-change', { state: 'connected' });

    expect(first.setAvailable).not.toHaveBeenCalled();
    expect(second.setAvailable).toHaveBeenCalledTimes(1);
    expect(appListener).toHaveBeenCalledTimes(1);
    expect(apiV2.listenerCount('protectv2-connection-error')).toBe(1);
  });

  test('starting twice registers a single listener pair', () => {
    const device = createDevice(homey);
    device._startConnectionMonitoring('v2');
    device._startConnectionMonitoring('v2');

    expect(apiV2.listenerCount('protectv2-connection-error')).toBe(1);
    expect(apiV2.listenerCount('protectv2-connection-change')).toBe(1);
  });

  test('a connection error marks the device unavailable after the debounce', () => {
    const device = createDevice(homey);
    device._startConnectionMonitoring('v2');

    apiV2.emit('protectv2-connection-error', { host: '10.0.0.1' });
    jest.advanceTimersByTime(19999);
    expect(device.setUnavailable).not.toHaveBeenCalled();
    jest.advanceTimersByTime(1);

    expect(device.setUnavailable).toHaveBeenCalledWith('msg.controller_unreachable');
  });

  test('an unconfigured API is skipped without error', () => {
    const device = createDevice(homey);
    device._startConnectionMonitoring('access');

    expect(device.error).not.toHaveBeenCalled();
    expect(device._connectionMonitorHandlers).toBeFalsy();
  });
});
