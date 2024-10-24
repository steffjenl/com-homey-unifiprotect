'use strict';

const BaseClass = require('./baseclass');
const WebSocket = require('ws');
const zlib = require('zlib');
const UfvConstants = require('./constants');

class ProtectWebSocket extends BaseClass {
    constructor(...props) {
        super(...props);
        this.loggedInStatus = 'Unknown';
        this.lastWebsocketMessage = null;
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

    // Return the realtime update events API URL.
    updatesUrl() {

        return 'wss://' + this.homey.app.api.getHost() + '/proxy/protect/ws/updates';
    }

    // Connect to the realtime update events API.
    launchUpdatesListener() {

        // If we already have a listener, we're already all set.
        if (this._eventListener) {
            return true;
        }

        const params = new URLSearchParams({ lastUpdateId: this.homey.app.api._lastUpdateId });

        this.homey.app.debug('Update listener: ' + this.updatesUrl() + '?' + params.toString());

        try {
            this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_STATUS, 'Connecting');
            this.loggedInStatus = 'Connecting';

            const _ws = new WebSocket(this.updatesUrl() + '?' + params.toString(),{
                headers: {
                    Cookie: this.homey.app.api.getProxyCookieToken()
                },
                rejectUnauthorized: false,
                perMessageDeflate: false
            });

            if (!_ws) {
                this.homey.app.debug('Unable to connect to the realtime update events API. Will retry again later.');
                delete this._eventListener;
                this._eventListenerConfigured = false;
                return false;
            }

            this._eventListener = _ws;

            // Connection opened
            this._eventListener.on('open', (event) => {
                this.homey.app.debug(this.homey.app.api.getNvrName() + ': Connected to the UniFi realtime update events API.');
                this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_STATUS, 'Connected');
                this.loggedInStatus = 'Connected';
            });

            this._eventListener.on('close', () => {
                // terminate and cleanup websocket connection and timers
                delete this._eventListener;
                this._eventListenerConfigured = false;
                clearInterval(this._pingPong);
                this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_STATUS, 'Disconnected');
                this.loggedInStatus = 'Disconnected';
            });

            this._eventListener.on('error', (error) => {
                this.homey.app.debug(error);
                // If we're closing before fully established it's because we're shutting down the API - ignore it.
                if (error.message !== 'WebSocket was closed before the connection was established') {
                    this.homey.app.debug(this.homey.app.api.getHost(), +': ' + error);
                }

                this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_STATUS, error.message);
                this.loggedInStatus = error.message;
            });
        } catch (error) {
            this.homey.app.debug(this.homey.app.api.getNvrName() + ': Error connecting to the realtime update events API: ' + error);
            this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_WEBSOCKET_STATUS, error);
            this.loggedInStatus = error;
        }

        return true;
    }

    disconnectEventListener() {
        return new Promise((resolve, reject) => {
            if (typeof this._eventListener !== 'undefined' && this._eventListener !== null) {
                this.homey.app.debug('Called terminate websocket');
                this._eventListener.close();
                delete this._eventListener;
            }
            this._eventListenerConfigured = false;
            resolve(true);
        });
    }

    reconnectUpdatesListener() {
        this.homey.app.debug('Called reconnectUpdatesListener');
        this.disconnectEventListener().then((res) => {
            this.waitForBootstrap();
        }).catch();
    }

    waitForBootstrap() {
        if (typeof this.homey.app.api._lastUpdateId !== 'undefined' && this.homey.app.api._lastUpdateId !== null) {
            this.homey.app.debug('Called waitForBootstrap');
            this.launchUpdatesListener();
            this.configureUpdatesListener(this);
        } else {
            this.homey.app.debug('Calling waitForBootstrap');
            this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
        }
    }

    /**
     * Update actions that we care about (doorbell rings, motion detection, smart detection)
     *
     * Example event:
     *
     * {
     *   action: "update"
     *   id: "someCameraId"
     *   modelKey: "camera"
     *   newUpdateId: "ignorethis"
     * }
     *
     * Example smart detection event
     *
     * {
     *   "action":{
     *     "action":"add",
     *     "newUpdateId":"newUpdateId",
     *     "modelKey":"event",
     *     "id":"id"
     *   },
     *   "payload":{
     *     "type":"smartDetectZone",
     *     "score":82,
     *     "smartDetectTypes":["vehicle"],
     *     "smartDetectEvents":[],
     *     "camera":"someCameraId",
     *     "modelKey":"event"
     *   }
     * }
     */
    shouldProcessEvent(updatePacket) {
        if (updatePacket.payload.stats) {
            // We're not interested in stats
            return false;
        } else if (updatePacket.action.action === 'update' && updatePacket.action.modelKey === 'camera') {
            // Updates lastMotion or the lastRing
            return true;
        } else if (updatePacket.action.action === 'add' && updatePacket.payload.type === 'smartDetectZone') {
            // Smart detections
            return true;
        } else if (updatePacket.action.action === 'update' && updatePacket.action.modelKey === 'light') {
            // Updates lastMotion or the lastRing
            return true;
        } else if (updatePacket.action.action === 'update' && updatePacket.action.modelKey === 'sensor') {
            // Updates lastMotion or the lastRing
            return true;
        } else if (updatePacket.action.action === 'add' && updatePacket.action.modelKey === 'event') {
            // Smart detections
            return true;
        } else if (updatePacket.action.action === 'update' && updatePacket.action.modelKey === 'event') {
            // Smart detections
            return true;
        }



        return false;
    }

    // Configure the realtime update events API listener to trigger events on accessories, like motion.
    configureUpdatesListener() {
        // Only configure the event listener if it exists and it's not already configured.
        if (!this._eventListener || this._eventListenerConfigured) {
            return true;
        }

        // Listen for any messages coming in from our listener.
        this._eventListener.on('message', (event) => {
            // set variable with decoded packet message
            const updatePacket = this.decodeUpdatePacket(event);

            if (!updatePacket) {
                return true;
            }

            if (
                updatePacket.action.modelKey !== 'nvr'
                && updatePacket.action.modelKey !== 'sensor'
                && updatePacket.action.modelKey !== 'bridge'
                && updatePacket.action.modelKey !== 'user'
                && typeof updatePacket.payload.wifiConnectionState === 'undefined'
                && typeof updatePacket.payload.stats === 'undefined'
                && typeof updatePacket.payload.permissions === 'undefined'
                && typeof updatePacket.payload.upSince === 'undefined'
            ) {
                this.homey.app.debug('event: ' + JSON.stringify(updatePacket));
            }

            if (updatePacket.action.modelKey === 'event' && ( updatePacket.payload.type === 'smartDetectZone' || updatePacket.payload.type === 'smartDetectLine') ) {
                this.homey.app.debug('smartDetectZone event: ' + JSON.stringify(updatePacket));
            }

            // Filter on what actions we're interested in only.
            if (!this.shouldProcessEvent(updatePacket)) {
                return true;
            }

            //
            this.lastWebsocketMessage = this.homey.app.toLocalTime(new Date()).toISOString().slice(0,16);

            // get payload from updatePacket
            const payload = updatePacket.payload;

            if (
                updatePacket.action.modelKey === 'event'
                && typeof updatePacket.action.recordId !== 'undefined'
                && typeof updatePacket.payload.smartDetectTypes !== 'undefined'
                && updatePacket.payload.smartDetectTypes.length > 0
            ) {
                this.homey.app.debug('smartDetectZone event filled smartDetectTypes array');
                // get protectcamera driver
                const driverCamera = this.homey.drivers.getDriver('protectcamera');
                // Get device from camera id
                const deviceId = updatePacket.action.recordId;
                const deviceCamera = driverCamera.getUnifiDeviceById(deviceId);
                if (deviceCamera) {
                    // Parse Websocket payload message
                    driverCamera.onParseWebsocketMessage(deviceCamera, payload, updatePacket.action.action, updatePacket.action.id);
                }
                // get doorbell driver
                const driverDoorbell = this.homey.drivers.getDriver('protectdoorbell');
                // Get device from camera id
                const deviceDoorbellId = updatePacket.action.recordId;
                const deviceDoorbell = driverDoorbell.getUnifiDeviceById(deviceDoorbellId);
                if (deviceDoorbell) {
                    // Parse Websocket payload message
                    driverDoorbell.onParseWebsocketMessage(deviceDoorbell, payload, updatePacket.action.action, updatePacket.action.id);
                }
            } else if (
                updatePacket.action.modelKey === 'event'
                && typeof updatePacket.action.recordId !== 'undefined'
                && typeof updatePacket.payload.type !== 'undefined'
                && updatePacket.payload.type === 'smartDetectZone'
            ) {
                this.homey.app.debug('smartDetectZone event without filled smartDetectTypes array');
                // get protectcamera driver
                const driverCamera = this.homey.drivers.getDriver('protectcamera');
                // Get device from camera id
                const deviceCamera = driverCamera.getUnifiDeviceById(updatePacket.action.recordId);
                if (deviceCamera) {
                    // Parse Websocket payload message
                    driverCamera.onParseWebsocketMessage(deviceCamera, payload, updatePacket.action.action, updatePacket.action.id);
                }
                // get doorbell driver
                const driverDoorbell = this.homey.drivers.getDriver('protectdoorbell');
                // Get device from camera id
                const deviceDoorbell = driverDoorbell.getUnifiDeviceById(updatePacket.action.recordId);
                if (deviceDoorbell) {
                    // Parse Websocket payload message
                    driverDoorbell.onParseWebsocketMessage(deviceDoorbell, payload, updatePacket.action.action, updatePacket.action.id);
                }
            } else if (updatePacket.action.modelKey === 'light') {
                // get protectlight driver
                const driver = this.homey.drivers.getDriver('protectlight');
                // Get device from camera id
                const deviceId = updatePacket.action.id;
                const device = driver.getUnifiDeviceById(deviceId);
                if (device) {
                    // Parse Websocket payload message
                    driver.onParseWebsocketMessage(device, payload);
                }
            } else if (updatePacket.action.modelKey === 'sensor') {
                // get protectsensor driver
                const driver = this.homey.drivers.getDriver('protectsensor');
                // Get device from camera id
                const deviceId = updatePacket.action.id;
                const device = driver.getUnifiDeviceById(deviceId);
                if (device) {
                    // Parse Websocket payload message
                    driver.onParseWebsocketMessage(device, payload);
                }
            } else if (updatePacket.action.modelKey === 'chime') {
                // get protectsensor driver
                const driver = this.homey.drivers.getDriver('protectchime');
                // Get device from camera id
                const deviceId = updatePacket.action.id;
                const device = driver.getUnifiDeviceById(deviceId);
                if (device) {
                    // Parse Websocket payload message
                    driver.onParseWebsocketMessage(device, payload);
                }
            } else {
                // get protectcamera driver
                const driverCamera = this.homey.drivers.getDriver('protectcamera');
                // Get device from camera id
                const deviceId = updatePacket.action.id;
                const deviceCamera = driverCamera.getUnifiDeviceById(deviceId);
                if (deviceCamera) {
                    // Parse Websocket payload message
                    driverCamera.onParseWebsocketMessage(deviceCamera, payload);
                }

                // get doorbell driver
                const driverDoorbell = this.homey.drivers.getDriver('protectdoorbell');
                // Get device from camera id
                const deviceDoorbellId = updatePacket.action.id;
                const deviceDoorbell = driverDoorbell.getUnifiDeviceById(deviceDoorbellId);
                if (deviceDoorbell) {
                    // Parse Websocket payload message
                    driverDoorbell.onParseWebsocketMessage(deviceDoorbell, payload);
                }
            }
        });
        this._eventListenerConfigured = true;
        return true;
    }

    // Process an update data packet and return the action and payload.
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

            this.homey.app.debug('Realtime update API: error decoding update packet: %s', error);
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
            payload: payloadFrame
        });
    }

    // Decode a frame, composed of a header and payload, received through the update events API.
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
                break;

            case 2:
                return payload.toString('utf8');
                break;

            case 3:
                return payload;
                break;

            default:
                this.homey.app.debug('Unknown payload packet type received in the realtime update events API: %s.', payloadFormat);
                return null;
                break;
        }
    }
}

module.exports = ProtectWebSocket;
