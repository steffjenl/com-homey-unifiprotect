'use strict';

const Homey = require('homey');
const UfvConstants = require("../../library/constants");
const { GUIDE_URL, getCamerasWithoutRtsp } = require('../../library/rtsp-status');

class UniFiDoorbellDriver extends Homey.Driver {
    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        // Register flow cards
        this._doorbellPressetTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_PRESET);
        this._deviceSmartDetectionTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION);
        this._deviceSmartDetectionTriggerPerson = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION_PERSON);
        this._deviceSmartDetectionTriggerVehicle = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION_VEHICLE);
        this._deviceSmartDetectionTriggerAnimal = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION_ANIMAL);
        this._deviceSmartDetectionTriggerPackage = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION_PACKAGE);
        this._deviceSmartDetectionTriggerLicensePlate = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION_LICENSEPLATE);
        this._deviceSmartDetectionTriggerFace = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION_FACE);
        this._deviceAudioDetectionTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_AUDIO_DETECTION);
        this._deviceAudioDetectionTrigger.registerRunListener(async (args, state) => {
            // Check if "any" is selected or if the detected audio type matches the selected type
            return args.audio_type === 'any' || args.audio_type === state.audio_detection_type;
        });
        this._deviceFingerprintIdentifiedTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FINGERPRINT_IDENTIFIED);
        this._deviceFingerprintUnknownTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FINGERPRINT_UNKNOWN);
        this._deviceDoorAccessTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOOR_ACCESS);
        this._deviceNFCCardScannedTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_NFC_CARD_SCANNED);
        this._deviceNFCUnknownCardScannedTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_NFC_UNKNOWN_CARD_SCANNED);
        //
        this.homey.app.debug('UniFiDoorbell Driver has been initialized');
    }

    onPair(session) {
        const homey = this.homey;
        session.setHandler("validate", async function (data) {
            const nvrip = homey.settings.get('ufp:nvrip') || homey.app.getV2Connection().host;
            return (nvrip ? 'ok' : 'nok:protect');
        });

        session.setHandler("check_rtsp", async (data) => {
            try {
                const doorbells = await this._listUnifiDoorbells();
                const disabled = await getCamerasWithoutRtsp(homey.app, doorbells);
                return { disabled: disabled, guideUrl: GUIDE_URL };
            } catch (error) {
                homey.app.debug('[protectdoorbell] check_rtsp error: ' + error);
                return { disabled: [], guideUrl: GUIDE_URL };
            }
        });

        session.setHandler("list_devices", async (data) => {
            try {
                const doorbells = await this._listUnifiDoorbells();
                return Object.values(doorbells).map((camera) => ({
                    data: { id: String(camera.id) },
                    name: camera.name,
                }));
            } catch (error) {
                homey.app.debug('[protectdoorbell] list_devices error: ' + error);
                return [];
            }
        });
    }

        async onRepair(session, device) {
        const homey = this.homey;

        session.setHandler('get_repair_data', async () => {
            const v2Conn = homey.app.getV2Connection();
            const nvrip = homey.settings.get('ufp:nvrip');
            const tokens = homey.settings.get('ufp:tokens') || {};
            const isV2 = !!(tokens.protectV2ApiKey);
            const host = v2Conn.host || nvrip || '';
            const port = v2Conn.port || 443;
            const connected = homey.app.isControllerReachable(isV2 ? 'v2' : 'v1');
            const status = isV2 
                ? (homey.app.apiV2 && homey.app.apiV2.websocket ? homey.app.apiV2.websocket.loggedInStatus : 'Disconnected')
                : (homey.app.api ? homey.app.api.loggedInStatus : 'Disconnected');

            return {
                deviceName: device ? device.getName() : 'UniFi Protect',
                apiType: 'protect',
                host,
                port,
                isV2,
                apiKey: tokens.protectV2ApiKey || '',
                connected,
                status,
            };
        });

        session.setHandler('save_repair_data', async (data) => {
            try {
                const host = data.host;
                const port = data.port || '443';
                const token = data.token;

                const tokens = homey.settings.get('ufp:tokens') || {};
                if (token) {
                    tokens.protectV2ApiKey = token;
                    homey.settings.set('ufp:tokens', tokens);
                }

                homey.settings.set('ufp:v2nvr', { nvrip: host, nvrport: port });
                homey.settings.set('ufp:nvrip', host);
                homey.settings.set('ufp:nvrport', port);

                if (tokens.protectV2ApiKey) {
                    homey.app._initProtectV2Stack();
                    await homey.app.appProtect.loginToProtectV2();
                } else {
                    homey.app.appProtect._appLogin();
                }

                if (device) {
                    await device.setAvailable().catch(homey.error);
                    if (typeof device.initDevice === 'function') {
                        await device.initDevice().catch(homey.error);
                    }
                }

                return { status: 'ok', message: 'Connection restored' };
            } catch (error) {
                homey.app.debug('[onRepair] save_repair_data error: ' + error);
                return { status: 'failure', error: error.message || String(error) };
            }
        });

        session.setHandler('validate', async () => {
            return 'ok';
        });
    }

    async repair(session, device) {
        return this.onRepair(session, device);
    }

    /**
     * Fetch the doorbells from whichever Protect API is available.
     */
    async _listUnifiDoorbells() {
        if (this.homey.app.isV1Available()) {
            return this.homey.app.api.getDoorbells();
        }
        if (this.homey.app.isV2Available()) {
            return this.homey.app.apiV2.getDoorbells();
        }
        this.homey.app.debug('[protectdoorbell] No API available for listing doorbells');
        return [];
    }

    onParseWebsocketMessage(camera, payload, actionType = null, eventId = null) {
        if (Object.prototype.hasOwnProperty.call(camera, '_events')) {
            if (payload.hasOwnProperty('isRecording')) {
                camera.onIsRecording(payload.isRecording);
            }

            if (payload.hasOwnProperty('isMicEnabled')) {
                camera.onIsMicEnabled(payload.isMicEnabled);
            }

            if (payload.hasOwnProperty('micVolume')) {
                camera.onMicVolume(payload.micVolume);
            }

            if (payload.hasOwnProperty('speakerSettings')) {
                if (payload.speakerSettings.hasOwnProperty('ringVolume')) {
                    camera.onRingVolume(payload.speakerSettings.ringVolume);
                }
                if (payload.speakerSettings.hasOwnProperty('speakerVolume')) {
                    camera.onSpeakerVolume(payload.speakerSettings.speakerVolume);
                }
            }

            if (payload.hasOwnProperty('isConnected')) {
                camera.onIsConnected(payload.isConnected);
            }

            if (payload.hasOwnProperty('recordingSettings') && payload.recordingSettings.hasOwnProperty('mode')) {
                camera.onRecordingMode(payload.recordingSettings.mode);
            }

            if (payload.hasOwnProperty('lastMotion')) {
                this.homey.app.debug('lastMotion ' + JSON.stringify(payload));
                camera.onMotionDetected(payload.lastMotion, payload.isMotionDetected);
            }

            if (payload.hasOwnProperty('lastRing')) {
                camera.onDoorbellRinging(payload.lastRing);
            }

            if (payload.hasOwnProperty('isDark')) {
                camera.onIsDark(payload.isDark);
            }

            if (payload.hasOwnProperty('ispSettings') && payload.ispSettings.hasOwnProperty('irLedMode')) {
                camera.onNightVisionMode(payload.ispSettings.irLedMode);
            }

            if (payload.hasOwnProperty('smartDetectTypes')) {
                this.homey.app.debug('onParseWebsocketMessage ' + JSON.stringify(payload));
                camera.onSmartDetection(payload, actionType, eventId);
            }

            if (payload.hasOwnProperty('type') && payload.type === 'fingerprintIdentified') {
                this.homey.app.debug('fingerprintIdentified ' + JSON.stringify(payload));
                camera.onFingerprintIdentified(payload, actionType, eventId).catch(this.error);
            }

            if (payload.hasOwnProperty('type') && payload.type === 'nfcCardScanned') {
                this.homey.app.debug('nfcCardScanned ' + JSON.stringify(payload));
                camera.onNFCCardScanned(payload, actionType, eventId).catch(this.error);
            }

            if (payload.hasOwnProperty('type') && payload.type === 'doorAccess') {
                this.homey.app.debug('doorAccess ' + JSON.stringify(payload));
                camera.onDoorAccess(payload, actionType, eventId).catch(this.error);
            }

            if (payload.hasOwnProperty('type') && payload.type === 'ring') {
                this.homey.app.debug('ring ' + JSON.stringify(payload));
                if (this.homey.app.apiV2.websocket.loggedInStatus !== 'Connected') {
                    camera.onDoorbellRinging(payload.start);
                }
            }

        }
    }

    getUnifiDeviceById(deviceId) {
        try {
            const devices = this.getDevices();
            const device = devices.find(device => String(device.getData().id) === String(deviceId));
            if (!device) return false;
            return device;
        } catch (Error) {
            return false;
        }
    }
}

module.exports = UniFiDoorbellDriver;
