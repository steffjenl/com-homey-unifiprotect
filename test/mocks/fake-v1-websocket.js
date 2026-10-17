'use strict';

const { EventEmitter } = require('events');
const zlib = require('zlib');
const ProtectWebSocket = require('../../library/websocket');

const HEADER_SIZE = 8;

// Builds one UniFi Protect update frame: 8-byte header (type, format, deflated, 0, size BE) + body.
function frame(frameType, format, body, { deflate = false } = {}) {
  const data = deflate ? zlib.deflateSync(body) : body;
  const header = Buffer.alloc(HEADER_SIZE);
  header.writeUInt8(frameType, 0);
  header.writeUInt8(format, 1);
  header.writeUInt8(deflate ? 1 : 0, 2);
  header.writeUInt32BE(data.length, 4);
  return Buffer.concat([header, data]);
}

const json = (value) => Buffer.from(JSON.stringify(value));

function encode(action, payload, opts = {}) {
  return Buffer.concat([frame(1, 1, json(action), opts), frame(2, 1, json(payload), opts)]);
}

const emptyDriver = () => ({ getUnifiDeviceById: () => false, onParseWebsocketMessage: jest.fn() });

function createWs({ drivers: extraDrivers = {}, bootstrap = { nvr: {} } } = {}) {
  const drivers = { protectcamera: emptyDriver(), protectdoorbell: emptyDriver(), ...extraDrivers };
  const debugLog = [];
  const ws = new ProtectWebSocket();
  const app = {
    debug: (...args) => debugLog.push(args.join(' ')),
    toLocalTime: (d) => d,
    onFobWebsocketMessage: jest.fn(),
    api: { _bootstrap: bootstrap },
  };
  ws.setHomeyObject({
    app,
    drivers: {
      getDriver: (id) => {
        if (!drivers[id]) throw new Error(`Driver not found: ${id}`);
        return drivers[id];
      },
    },
  });
  return { ws, app, debugLog };
}

function createListeningWs(opts) {
  const setup = createWs(opts);
  setup.ws._eventListener = new EventEmitter();
  setup.ws.configureUpdatesListener();
  setup.send = (action, payload) => setup.ws._eventListener.emit('message', encode(action, payload));
  return setup;
}

module.exports = {
  HEADER_SIZE, frame, json, encode, createWs, createListeningWs,
};
