'use strict';

const WebSocket = require('ws');
const BaseClass = require('./base-class');

class AccessWebSocket extends BaseClass {
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

    return `wss://${this.homey.app.accessApi.webclient._serverHost}:${this.homey.app.accessApi.webclient._serverPort}/api/v1/developer/devices/notifications`;
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
          Authorization: `Bearer ${this.homey.app.accessApi.webclient._apiToken}`,
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
        this.homey.app.log(`${this.homey.app.accessApi.webclient._serverHost}: Connected to the UniFi realtime update events API.`);
        this.loggedInStatus = 'Connected';
        this.heartbeat();
      });

      this._eventListener.on('pong', (event) => {
        this.homey.log('Received pong from access websocket');
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
          this.homey.app.log(this.homey.app.accessApi.webclient._serverHost, +': ' + error);
        }

        this.loggedInStatus = error.message;
      });
    } catch (error) {
      this.homey.app.log(`${this.homey.app.accessApi.webclient._serverHost}: Error connecting to the realtime update events API: ${error}`);
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
      return false;
    }
    //
    if (jsonData.event === 'access.base.info') {
      return false;
    }

    if (jsonData.event === 'access.logs.insights.add') {
      return false;
    }

    if (jsonData.event === 'access.logs.add') {
      return false;
    }

    if (jsonData.event === 'access.data.device.update') {
      return false;
    }

    if (jsonData.event === 'access.data.v2.device.update') {
      if (jsonData.data.hasOwnProperty('configs')) {
        return false;
      }
    }

    /*
        {
            "event":"access.data.v2.location.update","receiver_id":"","event_object_id":"9f485e3a-b4a2-46b1-bd14-5780539f0aee","save_to_history":false,
            "data":{"id":"ce884336-81c8-4f6a-8725-60c8ca76d91f","location_type":"door","name":"Hub Mini","up_id":"7dd4125f-4f38-4645-9739-7f279c1cdaf7","extras":null,"device_ids":["245a4c4ece14","1c0b8beec87e","672e0e8103aadb03e40003ff"],"state":{"lock":"locked","dps":"none","dps_connected":false,"emergency":{"software":"none","hardware":"none"},"is_unavailable":false},"thumbnail":{"type":"thumbnail","url":"/preview/camera_672e0e8103aadb03e40003ff_ce884336-81c8-4f6a-8725-60c8ca76d91f_1756391020.png","door_thumbnail_last_update":1756391020},"last_activity":1756394054},"meta":{"object_type":"location","target_field":null,"all_field":true,"id":"ce884336-81c8-4f6a-8725-60c8ca76d91f","source":""}}
         */

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

      // this.homey.app.log('Websocket event received: ' + JSON.stringify(eventData));

      if (
        eventData.event === 'access.data.v2.device.update'
                && typeof eventData.data !== 'undefined'
                && typeof eventData.data.location_states !== 'undefined'
      ) {
        this.homey.app.log('access.data.v2.device.update location_states event received');

        const driverHub = this.homey.drivers.getDriver('access-hub');
        const deviceHub = driverHub.getUnifiDeviceById(eventData.data.id);
        if (deviceHub) {
          driverHub.onParseWebsocketMessage(deviceHub, eventData.data);
        }
      } else if (
        eventData.event === 'access.data.v2.device.update'
                && typeof eventData.data !== 'undefined'
                && typeof eventData.data.access_method !== 'undefined'
      ) {
        this.homey.app.log('access.data.v2.device.update access_method event received');
        const driverHub = this.homey.drivers.getDriver('access-reader');
        const deviceHub = driverHub.getUnifiDeviceById(eventData.data.id);
        if (deviceHub) {
          driverHub.onParseWebsocketMessage(deviceHub, eventData.data);
        }
      } else if (
        eventData.event === 'access.data.v2.location.update'
      ) {
        this.homey.app.log('access.data.v2.location.update event received');
        const driverDoor = this.homey.drivers.getDriver('access-door');
        const deviceDoor = driverDoor.getUnifiDeviceById(eventData.data.id);
        if (deviceDoor) {
          driverDoor.onParseWebsocketMessage(deviceDoor, eventData.data);
        }

        const driverGarageDoor = this.homey.drivers.getDriver('access-garagedoor');
        const deviceGarageDoor = driverGarageDoor.getUnifiDeviceById(eventData.data.id);
        if (deviceGarageDoor) {
          driverGarageDoor.onParseWebsocketMessage(deviceGarageDoor, eventData.data);
        }
      } else {
        // this.homey.app.log('Websocket unhandled event received: ' + JSON.stringify(eventData));
      }
    });
    this._eventListenerConfigured = true;
    return true;
  }

}

module.exports = AccessWebSocket;
