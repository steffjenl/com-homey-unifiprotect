'use strict';

const { EventEmitter } = require('events');

// Wires a V2 websocket class (events or devices) to a fake socket + fake homey. Each driver in
// `drivers` is `{ device, driver }`-style: pass plain objects, they are returned as-is by
// homey.drivers.getDriver(id). `emit(packet)` pushes a JSON message through the real
// 'message' handler registered by configureNotificationsListener().
function createWebSocketHarness(WebSocketClass, drivers = {}) {
  const debugLog = [];
  const ws = new WebSocketClass();
  ws.setHomeyObject({
    app: {
      debug: (msg) => debugLog.push(msg),
      log: () => {},
      toLocalTime: (d) => d,
      onFobWebsocketMessage: jest.fn(),
    },
    log: () => {},
    error: () => {},
    drivers: {
      getDriver: (id) => {
        if (!drivers[id]) {
          throw new Error(`Driver not found: ${id}`);
        }
        return drivers[id];
      },
    },
  });
  ws._eventListener = new EventEmitter();
  ws.configureNotificationsListener();

  return {
    ws,
    homey: ws.homey,
    debugLog,
    emit: (packet) => ws._eventListener.emit('message', Buffer.from(typeof packet === 'string' ? packet : JSON.stringify(packet))),
  };
}

module.exports = { createWebSocketHarness };
