'use strict';

jest.mock('ws', () => {
  // jest.mock factories are hoisted, so the module must be required inside the factory.
  // eslint-disable-next-line global-require
  const { EventEmitter } = require('events');
  class FakeSocket extends EventEmitter {
    constructor(url, options) {
      super();
      this.url = url;
      this.options = options;
      this.readyState = 0;
      FakeSocket.instances.push(this);
    }

    close() {}

    ping() {}
  }
  FakeSocket.OPEN = 1;
  FakeSocket.instances = [];
  return FakeSocket;
});

const { EventEmitter } = require('events');
const FakeSocket = require('ws');
const DevicesWebSocket = require('../../library/protect-api-v2/web-socket-devices');
const EventsWebSocket = require('../../library/protect-api-v2/web-socket-events');

function createSocket(WebSocketClass) {
  const logLines = [];
  const apiV2 = new EventEmitter();
  apiV2.webclient = {
    _serverHost: '10.0.0.1',
    _serverPort: 443,
    _apiToken: 'secret-key',
    isCloudEnabled: () => false,
    getRequestHost: () => '10.0.0.1',
    getRequestPort: () => 443,
    buildApiPath: (resource) => `/proxy/protect/integration/v1/${resource}`,
  };

  const ws = new WebSocketClass();
  ws.setHomeyObject({
    app: {
      apiV2,
      debug: () => {},
      log: (msg) => logLines.push(String(msg)),
      toLocalTime: (d) => d,
    },
    log: () => {},
    error: () => {},
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    setInterval: (fn, ms) => setInterval(fn, ms),
    clearInterval: (id) => clearInterval(id),
    drivers: { getDriver: () => ({}) },
  });
  return { ws, apiV2, logLines };
}

function fail(ws, message) {
  const socket = ws._eventListener;
  socket.emit('error', new Error(message));
  socket.emit('close');
}

describe.each([
  ['devices', DevicesWebSocket],
  ['events', EventsWebSocket],
])('V2 %s websocket reconnect', (_name, WebSocketClass) => {
  beforeEach(() => {
    jest.useFakeTimers();
    FakeSocket.instances.length = 0;
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('backoff attempt grows across timer-driven reconnects', async () => {
    const { ws, logLines } = createSocket(WebSocketClass);
    ws.launchNotificationsListener();

    fail(ws, 'connect ECONNREFUSED 10.0.0.1:443');
    expect(ws._reconnectAttempt).toBe(1);

    // First retry is 10s +/- 20% jitter (floored at 10s).
    await jest.advanceTimersByTimeAsync(12001);
    expect(FakeSocket.instances).toHaveLength(2);

    fail(ws, 'connect ECONNREFUSED 10.0.0.1:443');
    expect(ws._reconnectAttempt).toBe(2);
    expect(logLines.some((line) => line.includes('reconnect attempt #2'))).toBe(true);

    // Second retry is 20s +/- 20%: nothing may happen before 16s.
    await jest.advanceTimersByTimeAsync(15000);
    expect(FakeSocket.instances).toHaveLength(2);
    await jest.advanceTimersByTimeAsync(9001);
    expect(FakeSocket.instances).toHaveLength(3);
  });

  test('an external reconnect resets the backoff', async () => {
    const { ws } = createSocket(WebSocketClass);
    ws.launchNotificationsListener();
    fail(ws, 'connect ECONNREFUSED 10.0.0.1:443');
    await jest.advanceTimersByTimeAsync(12001);
    fail(ws, 'connect ECONNREFUSED 10.0.0.1:443');
    expect(ws._reconnectAttempt).toBe(2);

    ws.reconnectNotificationsListener();
    await jest.advanceTimersByTimeAsync(0);

    expect(ws._reconnectAttempt).toBe(0);
  });

  test('a successful connection resets the backoff', () => {
    const { ws } = createSocket(WebSocketClass);
    ws.launchNotificationsListener();
    ws._reconnectAttempt = 3;

    ws._eventListener.emit('open');

    expect(ws._reconnectAttempt).toBe(0);
    expect(ws.loggedInStatus).toBe('Connected');
  });

  test.each(['401', '403'])('HTTP %s is not retried and reports a clear status', async (code) => {
    const { ws, logLines } = createSocket(WebSocketClass);
    ws.launchNotificationsListener();

    fail(ws, `Unexpected server response: ${code}`);

    expect(ws._reconnectTimeout).toBeNull();
    expect(ws._reconnectAttempt).toBe(0);
    expect(ws.loggedInStatus).toBe(`Unauthorized (API key rejected, HTTP ${code})`);

    await jest.advanceTimersByTimeAsync(600000);
    expect(FakeSocket.instances).toHaveLength(1);
    expect(logLines.some((line) => line.includes('API key rejected'))).toBe(true);
    expect(logLines.some((line) => line.includes('secret-key'))).toBe(false);
  });

  test('a manual reconnect after an auth failure tries again', async () => {
    const { ws } = createSocket(WebSocketClass);
    ws.launchNotificationsListener();
    fail(ws, 'Unexpected server response: 401');

    ws.reconnectNotificationsListener();
    await jest.advanceTimersByTimeAsync(0);

    expect(FakeSocket.instances).toHaveLength(2);
    expect(ws._authFailed).toBe(false);
    expect(ws.loggedInStatus).toBe('Connecting');
  });

  test('connection errors are emitted on the v2 API emitter', () => {
    const { ws, apiV2 } = createSocket(WebSocketClass);
    const onError = jest.fn();
    apiV2.on('protectv2-connection-error', onError);
    ws.launchNotificationsListener();

    ws._eventListener.emit('error', new Error('connect ECONNREFUSED 10.0.0.1:443'));

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ host: '10.0.0.1', port: 443 }));
  });
});
