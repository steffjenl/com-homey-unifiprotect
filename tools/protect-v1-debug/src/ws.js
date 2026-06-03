'use strict';

const WebSocket = require('ws');
const zlib = require('zlib');

const UPDATE_PACKET_HEADER_SIZE = 8;

function decodeUpdateFrame(packet, packetType) {
  const frameType = packet.readUInt8(0);
  if (packetType !== frameType) {
    return null;
  }

  const payloadFormat = packet.readUInt8(1);
  const isDeflated = packet.readUInt8(2);
  const payloadBytes = packet.slice(UPDATE_PACKET_HEADER_SIZE);
  const payload = isDeflated ? zlib.inflateSync(payloadBytes) : payloadBytes;

  if (frameType === 1) {
    return payloadFormat === 1 ? JSON.parse(payload.toString('utf8')) : null;
  }

  switch (payloadFormat) {
    case 1:
      return JSON.parse(payload.toString('utf8'));
    case 2:
      return payload.toString('utf8');
    case 3:
      return payload;
    default:
      return null;
  }
}

function decodeUpdatePacket(packet) {
  let dataOffset;
  try {
    dataOffset = packet.readUInt32BE(4) + UPDATE_PACKET_HEADER_SIZE;
    const dataHeaderOffset = dataOffset + 4;
    const payloadLength = packet.readUInt32BE(dataHeaderOffset);
    const expectedLength = dataOffset + UPDATE_PACKET_HEADER_SIZE + payloadLength;

    if (packet.length !== expectedLength) {
      throw new Error('Packet length does not match header information.');
    }
  } catch (error) {
    return null;
  }

  const actionFrame = decodeUpdateFrame(packet.slice(0, dataOffset), 1);
  const payloadFrame = decodeUpdateFrame(packet.slice(dataOffset), 2);

  if (!actionFrame || !payloadFrame) {
    return null;
  }

  return {
    action: actionFrame,
    payload: payloadFrame,
  };
}

function connectUpdates(options) {
  const wsUrl = 'wss://' + options.host + '/proxy/protect/ws/updates?lastUpdateId=' + encodeURIComponent(options.lastUpdateId);

  const socket = new WebSocket(wsUrl, {
    headers: {
      Cookie: options.cookie,
    },
    rejectUnauthorized: false,
    perMessageDeflate: false,
  });

  let heartbeatTimer = null;

  socket.on('open', () => {
    if (typeof options.onOpen === 'function') {
      options.onOpen();
    }

    heartbeatTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.ping();
      }
    }, 30000);
  });

  socket.on('pong', () => {
    if (typeof options.onPong === 'function') {
      options.onPong();
    }
  });

  socket.on('message', (binaryPacket) => {
    const packet = Buffer.isBuffer(binaryPacket) ? binaryPacket : Buffer.from(binaryPacket);
    const decoded = decodeUpdatePacket(packet);

    if (typeof options.onMessage === 'function') {
      options.onMessage({
        receivedAt: new Date().toISOString(),
        packetLength: packet.length,
        decoded: decoded,
      });
    }
  });

  socket.on('error', (error) => {
    if (typeof options.onError === 'function') {
      options.onError(error);
    }
  });

  socket.on('close', (code, reasonBuffer) => {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
      heartbeatTimer = null;
    }

    if (typeof options.onClose === 'function') {
      options.onClose(code, reasonBuffer ? reasonBuffer.toString('utf8') : '');
    }
  });

  return socket;
}

module.exports = {
  UPDATE_PACKET_HEADER_SIZE,
  decodeUpdateFrame,
  decodeUpdatePacket,
  connectUpdates,
};
