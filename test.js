// eslint-disable-next-line strict
const WebSocket = require('ws');
const zlib = require('zlib');
const UfvConstants = require('./library/constants');

class WS {
  constructor() {
    const _ws = new WebSocket('wss://192.168.178.8/proxy/protect/integration/v1/subscribe/devices', {
      headers: {
        'X-API-Key': 'CUrDnVGJr4dnrkGZlmEhDIZxQm_4WHs4',
      },
      rejectUnauthorized: false,
      perMessageDeflate: false,
    });

    if (!_ws) {
      this.homey.app.log('Unable to connect to the realtime update events API. Will retry again later.');
      delete this._eventListener;
      this._eventListenerConfigured = false;
      return false;
    }

    // Connection opened
    _ws.on('open', (event) => {
      // eslint-disable-next-line no-console
      console.log('Connected to the websocket server');
    });

    _ws.on('pong', (event) => {
      // eslint-disable-next-line no-console
      console.log('Received pong from websocket');
    });

    _ws.on('close', () => {
      // eslint-disable-next-line no-console
      console.log('Disconnected from the websocket server');
    });

    _ws.on('message', (event) => {
      console.log(event.toString());
    });
  }

  decodeUpdatePacket(packet) {

    // What we need to do here is to split this packet into the header and payload, and decode them.

    let dataOffset;

    try {

      // The fourth byte holds our payload size. When you add the payload size to our header frame size, you get the location of the
      // data header frame.
      dataOffset = packet.readUInt32BE(4) + UfvConstants.UPDATE_PACKET_HEADER_SIZE;

      // Validate our packet size, just in case we have more or less data than we expect. If we do, we're done for now.
      if (packet.length !== (dataOffset + UfvConstants.UPDATE_PACKET_HEADER_SIZE + packet.readUInt32BE(dataOffset + 4))) {
        throw new Error('Packet length doesn\'t match header information.');
      }

    } catch (error) {

      console.log('Realtime update API: error decoding update packet: %s', error);
      return null;

    }

    // Decode the action and payload frames now that we know where everything is.
    const actionFrame = this.decodeUpdateFrame(packet.slice(0, dataOffset), 1);
    const payloadFrame = this.decodeUpdateFrame(packet.slice(dataOffset), 2);

    dataOffset = null;

    if (!actionFrame || !payloadFrame) {
      return null;
    }

    return ({
      action: actionFrame,
      payload: payloadFrame,
    });
  }

  decodeUpdateFrame(packet, packetType) {

    // Read the packet frame type.
    const frameType = packet.readUInt8(0);

    // This isn't the frame type we were expecting - we're done.
    if (packetType !== frameType) {
      return null;
    }

    // Read the payload format.
    const payloadFormat = packet.readUInt8(1);

    // Check to see if we're compressed or not, and inflate if needed after skipping past the 8-byte header.
    const payload = packet.readUInt8(2) ? zlib.inflateSync(packet.slice(UfvConstants.UPDATE_PACKET_HEADER_SIZE)) : packet.slice(UfvConstants.UPDATE_PACKET_HEADER_SIZE);

    // If it's an action, it can only have one format.
    if (frameType === 1) {
      return (payloadFormat === 1) ? JSON.parse(payload.toString()) : null;
    }

    // Process the payload format accordingly.
    switch (payloadFormat) {
      case 1:
        // If it's data payload, it can be anything.
        return JSON.parse(payload.toString());

      case 2:
        return payload.toString('utf8');

      case 3:
        return payload;

      default:
        console.log('Unknown payload packet type received in the realtime update events API: %s.', payloadFormat);
        return null;
    }
  }

}

const ws = new WS();
