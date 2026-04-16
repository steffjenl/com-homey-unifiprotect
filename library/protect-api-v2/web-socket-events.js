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
                this.homey.log('Received pong from protect v2 events websocket');
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

            this.homey.app.debug('[V2 Events WS] ' + JSON.stringify(eventData));

            if (!eventData || !eventData.item || !eventData.item.device) {
                return;
            }

            const item = eventData.item;
            const deviceId = item.device;
            const eventType = eventData.type; // 'add' or 'update'
            const itemType = item.type; // 'ring', 'motion', 'smartDetectZone', etc.

            try {
                const driverCamera = this.homey.drivers.getDriver('protectcamera');
                const driverDoorbell = this.homey.drivers.getDriver('protectdoorbell');
                const deviceCamera = driverCamera.getUnifiDeviceById(deviceId);
                const deviceDoorbell = driverDoorbell.getUnifiDeviceById(deviceId);

                // Ring event (doorbell)
                if (itemType === 'ring' && eventType === 'add') {
                    this.homey.app.debug('[V2] doorbell ring event');
                    if (deviceDoorbell) {
                        deviceDoorbell.onDoorbellRinging(item.start);
                    }
                }

                // Motion event
                if (itemType === 'motion') {
                    if (eventType === 'add') {
                        // Motion started
                        this.homey.app.debug('[V2] motion start on ' + deviceId);
                        if (deviceCamera) {
                            deviceCamera.onMotionDetected(item.start, true);
                        }
                        if (deviceDoorbell) {
                            deviceDoorbell.onMotionDetected(item.start, true);
                        }
                    } else if (eventType === 'update' && item.end) {
                        // Motion ended
                        this.homey.app.debug('[V2] motion end on ' + deviceId);
                        if (deviceCamera) {
                            deviceCamera.onMotionDetected(item.end, false);
                        }
                        if (deviceDoorbell) {
                            deviceDoorbell.onMotionDetected(item.end, false);
                        }
                    }
                }

                // Smart detection event
                if (itemType === 'smartDetectZone') {
                    if (item.smartDetectTypes && item.smartDetectTypes.length > 0) {
                        this.homey.app.debug('[V2] smart detection: ' + JSON.stringify(item.smartDetectTypes) + ' on ' + deviceId);
                        const payload = {
                            smartDetectTypes: item.smartDetectTypes,
                            start: item.start,
                            end: item.end || null,
                        };
                        if (deviceCamera) {
                            driverCamera.onParseWebsocketMessage(deviceCamera, payload, eventType, item.id);
                        }
                        if (deviceDoorbell) {
                            driverDoorbell.onParseWebsocketMessage(deviceDoorbell, payload, eventType, item.id);
                        }
                    }
                }

            } catch (e) {
                this.homey.app.debug('[V2 Events WS] dispatch error: ' + e);
            }
        });
        this._eventListenerConfigured = true;
        return true;
    }

}

module.exports = ProtectWebSocket;
