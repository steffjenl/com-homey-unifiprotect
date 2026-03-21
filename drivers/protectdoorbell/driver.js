'use strict';

const Homey = require('homey');
const UfvConstants = require("../../library/constants");

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
        this._deviceDoorAccessTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOOR_ACCESS);
        this._deviceNFCCardScannedTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_NFC_CARD_SCANNED);
        //
        this.homey.app.debug('UniFiDoorbell Driver has been initialized');
    }

    onPair(session) {
        const homey = this.homey;
        session.setHandler("validate", async function (data) {
            const nvrip = homey.settings.get('ufp:nvrip');
            return (nvrip ? 'ok' : 'nok');
        });

        session.setHandler("list_devices", async function (data) {
            try {
                const doorbells = await homey.app.api.getDoorbells();
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
                camera.onFingerprintIdentified(payload, actionType, eventId);
            }

            if (payload.hasOwnProperty('type') && payload.type === 'nfcCardScanned') {
                this.homey.app.debug('nfcCardScanned ' + JSON.stringify(payload));
                camera.onNFCCardScanned(payload, actionType, eventId);
            }

            if (payload.hasOwnProperty('type') && payload.type === 'doorAccess') {
                this.homey.app.debug('doorAccess ' + JSON.stringify(payload));
                camera.onDoorAccess(payload, actionType, eventId);
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
