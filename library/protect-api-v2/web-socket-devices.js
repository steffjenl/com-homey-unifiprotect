'use strict';

const WebSocketEvents = require('ws');
const BaseClass = require('../baseclass');

class ProtectWebSocket extends BaseClass {
  constructor(...props) {
    super(...props);
    this.loggedInStatus = 'Unknown';
    this.lastWebsocketMessage = null;
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
      if (this._eventListener.readyState === WebSocketEvents.OPEN) {
        return true;
      }
    }
    return false;
  }

  getLastWebsocketMessageTime() {
    return this.lastWebsocketMessage;
  }

  notificationsUrl() {

      // https://YOUR_CONSOLE_IP/proxy/protect/integration/v1/subscribe/devices
    return `wss://${this.homey.app.apiV2.webclient._serverHost}:${this.homey.app.apiV2.webclient._serverPort}/proxy/protect/integration/v1/subscribe/devices`;
  }

  launchNotificationsListener() {

    // If we already have a listener, we're already all set.
    if (this._eventListener) {
      return true;
    }

    this.homey.app.log(`Update listener: ${this.notificationsUrl()}`);

    try {
      this.loggedInStatus = 'Connecting';

      const _ws = new WebSocketEvents(this.notificationsUrl(), {
        headers: {
            'X-API-KEY': `${this.homey.app.apiV2.webclient._apiToken}`,
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
        this.homey.app.log(`${this.homey.app.apiV2.webclient._serverHost}: Connected to the UniFi realtime update events API.`);
        this.loggedInStatus = 'Connected';
        this.heartbeat();
      });

      this._eventListener.on('pong', (event) => {
        this.homey.log('Received pong from protect v2 devices websocket');
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
          this.homey.app.log(this.homey.app.apiV2.webclient._serverHost, +': ' + error);
        }

        this.loggedInStatus = error.message;
      });
    } catch (error) {
      this.homey.app.log(`${this.homey.app.apiV2.webclient._serverHost}: Error connecting to the realtime update events API: ${error}`);
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

      this.homey.app.debug('Websocket V2 Devices event received: ' + JSON.stringify(eventData));

      if (!eventData || !eventData.item || !eventData.item.modelKey) {
        return;
      }

      const payload = eventData.item;
      const modelKey = payload.modelKey;
      const deviceId = payload.id;

      this.homey.app.debug('[V2 Devices WS] ' + modelKey + ' ' + deviceId + ' ' + eventData.type);

      try {
        if (modelKey === 'camera') {
          const driverCamera = this.homey.drivers.getDriver('protectcamera');
          const deviceCamera = driverCamera.getUnifiDeviceById(deviceId);
          if (deviceCamera) {
            driverCamera.onParseWebsocketMessage(deviceCamera, payload);
          }

          const driverDoorbell = this.homey.drivers.getDriver('protectdoorbell');
          const deviceDoorbell = driverDoorbell.getUnifiDeviceById(deviceId);
          if (deviceDoorbell) {
            driverDoorbell.onParseWebsocketMessage(deviceDoorbell, payload);
          }
        } else if (modelKey === 'light') {
          const driver = this.homey.drivers.getDriver('protectlight');
          const device = driver.getUnifiDeviceById(deviceId);
          if (device) {
            driver.onParseWebsocketMessage(device, payload);
          }
        } else if (modelKey === 'sensor') {
          const driver = this.homey.drivers.getDriver('protectsensor');
          const device = driver.getUnifiDeviceById(deviceId);
          if (device) {
            driver.onParseWebsocketMessage(device, payload);
          }
        } else if (modelKey === 'chime') {
          const driver = this.homey.drivers.getDriver('protectchime');
          const device = driver.getUnifiDeviceById(deviceId);
          if (device) {
            driver.onParseWebsocketMessage(device, payload);
          }
        } else if (modelKey === 'nvr') {
          try {
            const alarmDriver = this.homey.drivers.getDriver('protect-nvr-alarm');
            const alarmDevice = alarmDriver.getNVRAlarmDevice();
            if (alarmDevice) {
              alarmDriver.onParseWebsocketMessage(alarmDevice, payload);
            }
          } catch (e) {
            // driver may not be installed
          }
        }
      } catch (e) {
        this.homey.app.debug('[V2 Devices WS] dispatch error: ' + e);
      }

    });
    this._eventListenerConfigured = true;
    return true;
  }

}

module.exports = ProtectWebSocket;
