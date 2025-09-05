'use strict';

const WebSocket = require('ws');
const BaseClass = require('./base-class');

class ProtectWebSocket extends BaseClass {
  constructor(type, ...props) {
    super(...props);
    this.loggedInStatus = 'Unknown';
    this.lastWebsocketMessage = null;
    this._eventListener = null;
    this.websocketType = type;
  }

  heartbeat() {
    this.homey.log('Send heartbeat ping to websocket');
    this.homey.clearInterval(this.pingTimeout);

    if (typeof this._eventListener !== 'undefined' && this._eventListener !== null) {
      this.pingTimeout = this.homey.setInterval(() => {
        this._eventListener.ping();
      }, 30000);
    }
  }

  isWebsocketConnected() {
    if (typeof this._eventListener !== 'undefined' && this._eventListener !== null) {
      if (this._eventListener.readyState === WebSocket.OPEN) {
        return true;
      }
    }
    return false;
  }

  getLastWebsocketMessageTime() {
    return this.lastWebsocketMessage;
  }

  notificationsUrl() {

    if (this.websocketType === 'events') {
      return `wss://${this.homey.app.apiV2.webclient._serverHost}/proxy/protect/integration/v1/subscribe/events`;
    }
    return `wss://${this.homey.app.apiV2.webclient._serverHost}/proxy/protect/integration/v1/subscribe/devices`;
  }

  launchNotificationsListener() {

    // If we already have a listener, we're already all set.
    if (this._eventListener) {
      return true;
    }

    this.homey.app.log(`Update listener: ${this.notificationsUrl()}`);

    try {
      this.loggedInStatus = 'Connecting';

      const _ws = new WebSocket(this.notificationsUrl(), {
        headers: {
          'X-API-Key': `${this.homey.app.apiV2.webclient._apiToken}`,
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

      this._eventListener = _ws;

      // Connection opened
      this._eventListener.on('open', (event) => {
        this.homey.app.log(`${this.homey.app.api.webclient._serverHost}: Connected to the UniFi realtime update events API.`);
        this.loggedInStatus = 'Connected';
        this.heartbeat();
      });

      this._eventListener.on('pong', (event) => {
        this.homey.log(`Received pong from websocket ${this.websocketType}`);
      });

      this._eventListener.on('close', () => {
        // terminate and cleanup websocket connection and timers
        delete this._eventListener;
        this._eventListenerConfigured = false;
        this.homey.clearTimeout(this.pingTimeout);
        this.loggedInStatus = 'Disconnected';
      });

      this._eventListener.on('error', (error) => {
        this.homey.app.log(error);
        // If we're closing before fully established it's because we're shutting down the API - ignore it.
        if (error.message !== 'WebSocket was closed before the connection was established') {
          this.homey.app.log(this.homey.app.api.webclient._serverHost, +': ' + error);
        }

        this.loggedInStatus = error.message;
      });
    } catch (error) {
      this.homey.app.log(`${this.homey.app.api.webclient._serverHost}: Error connecting to the realtime update events API: ${error}`);
      this.loggedInStatus = error;
    }

    return true;
  }

  disconnectEventListener() {
    return new Promise((resolve, reject) => {
      if (typeof this._eventListener !== 'undefined' && this._eventListener !== null) {
        this.homey.app.log('Called terminate websocket');
        this._eventListener.close();
        delete this._eventListener;
      }
      this._eventListenerConfigured = false;
      resolve(true);
    });
  }

  reconnectNotificationsListener() {
    this.homey.app.log('Called reconnectUpdatesListener');
    this.disconnectEventListener().then((res) => {
      this.launchNotificationsListener();
      this.configureNotificationsListener(this);
    }).catch();
  }

  /*  */
  shouldProcessEvent(updatePacket) {
    if (!updatePacket || updatePacket == 'Hello') {
      return false;
    }
    const jsonData = JSON.parse(updatePacket);
    if (!jsonData || !jsonData.data || jsonData.data.length === 0) {
      // return false;
    }

    return true;
  }

  configureNotificationsListener() {
    // Only configure the event listener if it exists and it's not already configured.
    if (!this._eventListener || this._eventListenerConfigured) {
      return true;
    }

    // Listen for any messages coming in from our listener.
    this._eventListener.on('message', (event) => {

      if (!this.shouldProcessEvent(event.toString())) {
        return;
      }

      const eventData = JSON.parse(event.toString());

      this.lastWebsocketMessage = this.homey.app.toLocalTime(new Date()).toISOString().slice(0, 16);

      this.homey.app.log(`Websocket (${this.websocketType}) event received: ${JSON.stringify(eventData)}`);

      if (
        eventData.event === 'add'
                && typeof eventData.item !== 'undefined'
                && typeof eventData.item.type !== 'undefined'
                && eventData.item.type === 'motion'
      ) {
        this.homey.app.log('motion event received');

        const driverCamera = this.homey.drivers.getDriver('protectcamera');
        const deviceCamera = driverCamera.getUnifiDeviceById(eventData.item.device);
        if (deviceCamera) {
          driverCamera.onParseWebsocketMessage(deviceCamera, eventData.item);
        }

        const driverDoorbell = this.homey.drivers.getDriver('protectcamera');
        const deviceDoorbell = driverDoorbell.getUnifiDeviceById(eventData.item.device);
        if (deviceCamera) {
          driverDoorbell.onParseWebsocketMessage(deviceDoorbell, eventData.item);
        }
      } else if (
        eventData.event === 'update'
                && typeof eventData.item !== 'undefined'
                && typeof eventData.item.modelKey !== 'undefined'
                && eventData.item.modelKey === 'camera'
      ) {
        this.homey.app.log('update camera event received');

        const driverCamera = this.homey.drivers.getDriver('protectcamera');
        const deviceCamera = driverCamera.getUnifiDeviceById(eventData.item.device);
        if (deviceCamera) {
          driverCamera.onParseWebsocketMessage(deviceCamera, eventData.item);
        }

        const driverDoorbell = this.homey.drivers.getDriver('protectcamera');
        const deviceDoorbell = driverDoorbell.getUnifiDeviceById(eventData.item.device);
        if (deviceCamera) {
          driverDoorbell.onParseWebsocketMessage(deviceDoorbell, eventData.item);
        }
      } else {
        this.homey.app.log(`Websocket unhandled event received: ${JSON.stringify(eventData)}`);
      }
    });
    this._eventListenerConfigured = true;
    return true;
  }

}

module.exports = ProtectWebSocket;
