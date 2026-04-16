'use strict';

const BaseClass = require('./baseclass');
const UfvConstants = require('./constants');

// 2700000 miliseconds is 45 minutes
const RefreshCookieTime = 2700000;

class AppProtect extends BaseClass {

    async onInit() {
        this.homey.app.debug('AppProtect onInit');
        await this.registerFlowAndActionCards();
    }

    async registerFlowAndActionCards() {

        this.homey.app._snapshotTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SNAPSHOT_CREATED);
        this.homey.app._packageSnapshotTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_PACKAGE_SNAPSHOT_CREATED);
        this.homey.app._connectionStatusTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_CONNECTION_CHANGED);
        this.homey.app._doorbellRingingTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_DOORBELL_RINGING);
        this.homey.app._smartDetectionTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION);
        this.homey.app._smartDetectionTriggerPerson = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_PERSON);
        this.homey.app._smartDetectionTriggerVehicle = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_VEHICLE);
        this.homey.app._smartDetectionTriggerAnimal = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_ANIMAL);
        this.homey.app._smartDetectionTriggerPackage = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_PACKAGE);
        this.homey.app._smartDetectionTriggerLicensePlate = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_LICENSEPLATE);
        this.homey.app._smartDetectionTriggerFace = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_FACE);
        this.homey.app._fingerPrintIdentifiedTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_FINGERPRINT_IDENTIFIED);
        this.homey.app._doorAccessTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_DOOR_ACCESS);
        this.homey.app._nfcCardScannedTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_NFC_CARD_SCANNED);
        this.homey.app._nfcUnknownCardScannedTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_NFC_UNKNOWN_CARD_SCANNED);

        // Weather
        this.homey.app._weatherUpdatedTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_WEATHER_UPDATED);

        const _actionTakeSnapshot = this.homey.flow.getActionCard(UfvConstants.ACTION_TAKE_SNAPSHOT);
        _actionTakeSnapshot.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    device._createSnapshotImage(true);
                }
            }
            return Promise.resolve(true);
        });

        const _setRecordingMode = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_RECORDING_MODE);
        _setRecordingMode.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                return this.homey.app.api.setRecordingMode(args.device.getData(), args.recording_mode);
            }
            return Promise.resolve(true);
        });

        // V2 Actions
        const _actionTakeSnapshotV2 = this.homey.flow.getActionCard(UfvConstants.ACTION_TAKE_SNAPSHOT_V2);
        _actionTakeSnapshotV2.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    device._createSnapshotImage(true);
                }
            }
            return Promise.resolve(true);
        });

        const _setRecordingModeV2 = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_RECORDING_MODE_V2);
        _setRecordingModeV2.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                if (this.homey.app.isV1Available()) {
                    return this.homey.app.api.setRecordingMode(args.device.getData(), args.recording_mode);
                } else if (this.homey.app.isV2Available()) {
                    // V2 does not support changing recording mode directly
                    this.homey.app.debug('[V2] setRecordingMode not available in V2 Integration API');
                }
            }
            return Promise.resolve(true);
        });

        const _setChimeVolume = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_CHIME_ONOFF);
        _setChimeVolume.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                let volume = 0;
                if (args.enabled) {
                    volume = args.volume;
                }
                return this.homey.app.api.setChimeVolume(args.device.getData(), volume);
            }
            return Promise.resolve(true);
        });

        const _setNightVisionMode = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_NIGHT_VISION_MODE);
        _setNightVisionMode.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                return this.homey.app.api.setNightVisionMode(args.device.getData(), args.nightvision_mode);
            }
            return Promise.resolve(true);
        });

        const _setLCDMessage = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_LCD_MESSAGE);
        _setLCDMessage.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                this.homey.app.api.setLCDMessage(args.device.getData(), args.message.substring(0, 29))
                    .then(this.homey.app.debug.bind(this, '[lcd_message.set]'))
                    .catch(this.error.bind(this, '[lcd_message.set]'));
            }
            return Promise.resolve(true);
        });

        const _setCameraStatusLed = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_CAMERA_STATUS_LED);
        _setCameraStatusLed.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                return this.homey.app.api.setStatusLed(args.device.getData(), args.enabled);
            }
            return Promise.resolve(true);
        });

        const _setDoorbellStatusLed = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DOORBELL_STATUS_LED);
        _setDoorbellStatusLed.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                return this.homey.app.api.setStatusLed(args.device.getData(), args.enabled);
            }
            return Promise.resolve(true);
        });

        const _setDoorbellStatusSound = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DOORBELL_STATUS_SOUND);
        _setDoorbellStatusSound.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                return this.homey.app.api.setStatusSound(args.device.getData(), args.enabled);
            }
            return Promise.resolve(true);
        });

        const _setDeviceCameraStatusLed = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_CAMERA_STATUS_LED);
        _setDeviceCameraStatusLed.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                return this.homey.app.api.setStatusLed(args.device.getData(), args.enabled);
            }
            return Promise.resolve(true);
        });

        const _setDeviceDoorbellStatusLed = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_DOORBELL_STATUS_LED);
        _setDeviceDoorbellStatusLed.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                return this.homey.app.api.setStatusLed(args.device.getData(), args.enabled);
            }
            return Promise.resolve(true);
        });

        const _setDeviceDoorbellStatusSound = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_DOORBELL_STATUS_SOUND);
        _setDeviceDoorbellStatusSound.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                return this.homey.app.api.setStatusSound(args.device.getData(), args.enabled);
            }
            return Promise.resolve(true);
        });

        const _actionTakePackageSnapshot = this.homey.flow.getActionCard(UfvConstants.ACTION_TAKE_PACKAGE_SNAPSHOT);
        _actionTakePackageSnapshot.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    return device._createSnapshotPackageImage(true);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetCameraBlackout = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_CAMERA_BLACKOUT);
        _actionSetCameraBlackout.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`Set Camera Blackout ${args.device.getData().id} to ${args.enabled}`);
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    this.homey.app.debug(`Found device ${device.getName()}`);
                    return this.homey.app.api.setCameraBlackout(device.getData(), args.enabled).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetDoorbellBlackout = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_DOORBELL_BLACKOUT);
        _actionSetDoorbellBlackout.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    return this.homey.app.api.setCameraBlackout(device.getData(), args.enabled);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetCameraPatrolStop = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_PATROL_STOP);
        _actionSetCameraPatrolStop.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`Set Patrol Stop ${args.device.getData().id}`);
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    this.homey.app.debug(`Found device ${device.getName()}`);
                    return this.homey.app.api.setPatrolStop(device.getData()).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetCameraPatrolStart = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_PATROL_START);
        _actionSetCameraPatrolStart.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`Set Patrol Start ${args.device.getData().id} to ${args.presentId}`);
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    this.homey.app.debug(`Found device ${device.getName()}`);
                    return this.homey.app.api.setPatrolStart(device.getData(), args.presentId).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetCameraPTZHome = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_PTZ_HOME);
        _actionSetCameraPTZHome.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`PTZ Reset to home position ${args.device.getData().id}`);
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    this.homey.app.debug(`Found device ${device.getName()}`);
                    return this.homey.app.api.setPTZHome(device.getData()).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetCameraPTZPreset = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_PTZ_PRESET);
        _actionSetCameraPTZPreset.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`PTZ Move to preset ${args.device.getData().id} to ${args.presentId}`);
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    this.homey.app.debug(`Found device ${device.getName()}`);
                    return this.homey.app.api.setPTZPreset(device.getData(), args.presentId).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetColorNightVision = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_SET_COLOR_NIGHT_VISION);
        _actionSetColorNightVision.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`Set Color Night Vision ${args.device.getData().id} to ${args.enabled}`);
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    this.homey.app.debug(`Found device ${device.getName()}`);
                    return this.homey.app.api.setColorNightVision(device.getData(), args.enabled).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetAutoTracking = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_SET_AUTO_TRACKING);
        _actionSetAutoTracking.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`Set Auto Tracking Options ${args.device.getData().id} to ${args.person} and ${args.smart_zoom}`);
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    this.homey.app.debug(`Found device ${device.getName()}`);
                    return this.homey.app.api.setAutoTracking(device.getData(), args.person, args.smart_zoom).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionTestRingtone = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_TEST_RINGTONE);
        _actionTestRingtone.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`Test Ringtone on ${args.device.getData().id}`);
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    this.homey.app.debug(`Found device ${device.getName()}`);
                    return this.homey.app.api.testRingtone(device.getData()).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionTestSiren = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_TEST_SIREN);
        _actionTestSiren.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`Test Siren on ${args.device.getData().id}`);
                // Get device from camera id
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    this.homey.app.debug(`Found device ${device.getName()}`);
                    return this.homey.app.api.testSiren(device.getData(), args.volume).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetDoorbellRingVolume = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_DOORBELL_RING_VOLUME);
        _actionSetDoorbellRingVolume.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`[AppProtect] Set doorbell ring volume ${args.device.getData().id} to ${args.volume}`);
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    return this.homey.app.api.setDoorbellRingVolume(device.getData(), args.volume).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetDoorbellSpeakerVolume = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_DOORBELL_SPEAKER_VOLUME);
        _actionSetDoorbellSpeakerVolume.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                this.homey.app.debug(`[AppProtect] Set doorbell speaker volume ${args.device.getData().id} to ${args.volume}`);
                const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
                if (device) {
                    return this.homey.app.api.setDoorbellTalkbackVolume(device.getData(), args.volume).catch(this.error);
                }
            }
            return Promise.reject(new Error('No device found'));
        });

        const _actionSetDoorbellChimeVolume = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_DOORBELL_CHIME_VOLUME);
        _actionSetDoorbellChimeVolume.registerRunListener(async (args, state) => {
            if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
                const doorbellId = String(args.device.getData().id);
                this.homey.app.debug(`[AppProtect] Set paired chime volume for doorbell ${doorbellId} to ${args.volume}`);
                const chimes = await this.homey.app.api.getChimes().catch(this.error);
                if (!chimes) return Promise.reject(new Error('Could not retrieve chimes'));
                const paired = chimes.filter((chime) => Array.isArray(chime.cameraIds) && chime.cameraIds.map(String).includes(doorbellId));
                if (paired.length === 0) return Promise.reject(new Error('No paired chime found for this doorbell'));
                await Promise.all(paired.map((chime) => this.homey.app.api.setChimeVolume(chime, args.volume / 100)));
                return Promise.resolve(true);
            }
            return Promise.reject(new Error('No device found'));
        });

    }

    async loginToProtectV2() {
        // Validate NVR IP address
        const nvrip = this.homey.settings.get('ufp:nvrip');
        if (!nvrip) {
            this.log('NVR IP address not set.');
            return;
        }

        // Setting NVR Port when set
        // const nvrport = this.homey.settings.get('ufp:nvrport');

        // Validate NVR credentials
        const tokens = this.homey.settings.get('ufp:tokens');
        if (!tokens) {
            this.log('Tokens not set.');
            return;
        }

        if (!tokens.protectV2ApiKey || tokens.protectV2ApiKey === '' || tokens.protectV2ApiKey === 'undefined') {
            this.log('Protect V2 API Key not set.');
            return;
        }

        this.homey.app.apiV2.setSettings(nvrip, 443, tokens.protectV2ApiKey);

        this.homey.app.apiV2.websocket.reconnectNotificationsListener();
        this.homey.app.apiV2.websocketDevices.reconnectNotificationsListener();

        this.homey.app.apiV2.loggedInStatus = 'Connected';
    }

    _appLogin() {
        this.homey.app.debug('Protect Logging in...');

        // Validate NVR IP address
        const nvrip = this.homey.settings.get('ufp:nvrip');
        if (!nvrip) {
            this.homey.app.debug('NVR IP address not set.');
            return;
        }

        // Setting NVR Port when set
        const nvrport = this.homey.settings.get('ufp:nvrport');

        // Validate NVR credentials
        const credentials = this.homey.settings.get('ufp:credentials');
        if (!credentials) {
            this.homey.app.debug('Credentials not set.');
            return;
        }

        // Log in to NVR
        this.homey.app.api.login(nvrip, nvrport, credentials.username, credentials.password)
            .then(() => {
                this.homey.app.api.getBootstrapInfo()
                    .then(() => {
                        this.homey.app.debug('Bootstrap loaded.');
                        this.debuggedIn = true;
                        this.nvrIp = nvrip;
                        this.nvrPort = nvrport;
                        this.nvrUsername = credentials.username;
                        this.nvrPassword = credentials.password;

                        this.homey.app.debug('Logged in.');
                    })
                    .catch((error) => this.error(error));
            })
            .catch((error) => this.error(error));
    }

    cleanDeviceStorage() {
        const driverDoorbell = this.homey.drivers.getDriver('protectdoorbell');
        const driverCamera = this.homey.drivers.getDriver('protectcamera');

        driverDoorbell.getDevices().forEach((device) => {
            device.cleanSmartDetectionEvents();
        });

        driverCamera.getDevices().forEach((device) => {
            device.cleanSmartDetectionEvents();
        });

    }

    _refreshCookie() {
        this.homey.app.api._lastUpdateId = null;

        // Validate NVR IP address
        const nvrip = this.homey.settings.get('ufp:nvrip');
        if (!nvrip) {
            this.homey.app.debug('NVR IP address not set.');
            return;
        }

        // Setting NVR Port when set
        const nvrport = this.homey.settings.get('ufp:nvrport');

        // Validate NVR credentials
        const credentials = this.homey.settings.get('ufp:credentials');
        if (!credentials) {
            this.homey.app.debug('Credentials not set.');
            return;
        }

        this.homey.app.api.login(nvrip, nvrport, credentials.username, credentials.password)
            .then(() => {
                this.homey.app.debug('Logged in again to refresh cookie.');
                this.homey.app.api.getBootstrapInfo()
                    .then(() => {
                        this.homey.app.debug('Bootstrap loaded.');
                        this.debuggedIn = true;
                    })
                    .catch((error) => this.error(error));
            })
            .catch((error) => this.error(error));
        // }

        // clean Device Storage
        // this.cleanDeviceStorage();

        // // _refreshCookie after 1 hour
        // const timeOutFunction = function () {
        //     this._refreshCookie();
        // }.bind(this);
        // this.homey.setTimeout(timeOutFunction, RefreshCookieTime);
    }

    _registerSnapshotToken() {
        // Register snapshot image token
        this.homey.flow.createToken('ufv_snapshot', {
            type: 'image',
            title: 'Snapshot',
        });
    }

    async refreshAuthTokens() {
        const refreshAuthTokens = this.homey.setInterval(() => {
            try {
                this.homey.app.debug('Refreshing auth tokens');

                // Only refresh V1 (username/password) if credentials are configured
                const credentials = this.homey.settings.get('ufp:credentials');
                if (credentials && credentials.username && credentials.password) {
                    this.homey.app.api._lastUpdateId = null;
                    this._appLogin();
                }

                // clean Device Storage
                this.cleanDeviceStorage();

                const tokens = this.homey.settings.get('ufp:tokens');
                if (tokens) {
                    this.accessApiKey = tokens.accessApiKey;
                    this.protectV2ApiKey = tokens.protectV2ApiKey;
                }

                if (
                    tokens && typeof tokens.protectV2ApiKey !== 'undefined'
                    && tokens.protectV2ApiKey !== ''
                    && !this.homey.app.apiV2.websocket.isWebsocketConnected()
                ) {
                    this.homey.app.appProtect.loginToProtectV2().catch(this.error);
                }

                if (
                    tokens && typeof tokens.accessApiKey !== 'undefined'
                    && tokens.accessApiKey !== ''
                ) {
                    this.homey.app.appAccess.loginToAccess().catch(this.error);
                }
            } catch (error) {
                this.homey.error(`${JSON.stringify(error)}`);
            }
        }, this.homey.app._refreshAuthTokensnterval);
    }
}

module.exports = AppProtect;
