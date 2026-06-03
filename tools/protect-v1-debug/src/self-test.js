'use strict';

const assert = require('assert');
const zlib = require('zlib');
const { decodeUpdatePacket, UPDATE_PACKET_HEADER_SIZE } = require('./ws');

function buildFrame(frameType, payloadFormat, compress, payloadBuffer) {
  const payload = compress ? zlib.deflateSync(payloadBuffer) : payloadBuffer;
  const header = Buffer.alloc(UPDATE_PACKET_HEADER_SIZE);
  header.writeUInt8(frameType, 0);
  header.writeUInt8(payloadFormat, 1);
  header.writeUInt8(compress ? 1 : 0, 2);
  header.writeUInt8(0, 3);
  header.writeUInt32BE(payload.length, 4);
  return Buffer.concat([header, payload]);
}

const action = { action: 'add', id: 'event-1', modelKey: 'event', newUpdateId: '2' };
const payload = { type: 'smartDetectZone', camera: 'cam-1', modelKey: 'event' };

const actionFrame = buildFrame(1, 1, false, Buffer.from(JSON.stringify(action), 'utf8'));
const payloadFrame = buildFrame(2, 1, true, Buffer.from(JSON.stringify(payload), 'utf8'));
const packet = Buffer.concat([actionFrame, payloadFrame]);

const decoded = decodeUpdatePacket(packet);

assert(decoded, 'decoded packet must exist');
assert.deepStrictEqual(decoded.action, action, 'action frame must decode correctly');
assert.deepStrictEqual(decoded.payload, payload, 'payload frame must decode correctly');

console.log('self-test ok');
