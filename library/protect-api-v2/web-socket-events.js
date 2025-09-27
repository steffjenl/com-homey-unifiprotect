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

        // https://YOUR_CONSOLE_IP/proxy/protect/integration/v1/subscribe/events
        return `wss://${this.homey.app.apiV2.webclient._serverHost}:${this.homey.app.apiV2.webclient._serverPort}/proxy/protect/integration/v1/subscribe/events`;
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
                this.homey.log('Received pong from websocket');
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

            // this.homey.app.log('Websocket Events event received: ' + JSON.stringify(eventData));

            // {"item":{"id":"68d7a86500bddd03e4534022","modelKey":"event","type":"ring","start":1758963811189,"device":"672e0e8103aadb03e40003ff"},"type":"add"}

            // {"item":{"id":"68d7a86400b0dd03e4533fd8","modelKey":"event","type":"smartDetectZone","start":1758963809984,"device":"672e0e8103aadb03e40003ff","smartDetectTypes":[]},"type":"add"}
            // {"item":{"id":"68d7a86400b0dd03e4533fd8","modelKey":"event","type":"smartDetectZone","start":1758963809984,"device":"672e0e8103aadb03e40003ff","smartDetectTypes":["person"]},"type":"update"}

            // {"item":{"id":"68d7a86303addd03e4533fcd","modelKey":"event","type":"motion","start":1758963808651,"device":"672e0e8103aadb03e40003ff"},"type":"add"}
            // {"item":{"id":"68d7a86303addd03e4533fcd","modelKey":"event","type":"motion","start":1758963808651,"device":"672e0e8103aadb03e40003ff"},"type":"update"}

            if (
                eventData.type === 'add'
                && typeof eventData.item.device !== 'undefined'
                && eventData.item.type === 'ring'
            ) {
                this.homey.app.log('doorbell ring event received');

                const driverDoorbell = this.homey.drivers.getDriver('protectdoorbell');
                const deviceDoorbell = driverDoorbell.getUnifiDeviceById(eventData.item.device);
                if (deviceDoorbell) {
                    deviceDoorbell.onDoorbellRinging(eventData.item.start)
                }
            } else if (
                eventData.type === 'add'
                && typeof eventData.item.device !== 'undefined'
                && eventData.item.type === 'motion'
            ) {
                this.homey.app.log('camera motion event received');
                const driverCamera = this.homey.drivers.getDriver('protectcamera');
                const driverDoorbell = this.homey.drivers.getDriver('protectdoorbell');
                const deviceCamera = driverCamera.getUnifiDeviceById(eventData.item.device);
                const deviceDoorbell = driverDoorbell.getUnifiDeviceById(eventData.item.device);
                if (deviceCamera) {
                    deviceCamera.onMotionDetected(eventData.item.start, true);
                }
                if (deviceDoorbell) {
                    deviceDoorbell.onMotionDetected(eventData.item.start, true);
                }
            } else {
                this.homey.app.log('Websocket unhandled event received: ' + JSON.stringify(eventData));
            }
        });
        this._eventListenerConfigured = true;
        return true;
    }

}

module.exports = ProtectWebSocket;
