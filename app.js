// eslint-disable-next-line node/no-unpublished-require,strict

'use strict';

const Homey = require('homey');
const ProtectAPI = require('./library/protectapi');
const AppProtect = require('./library/app-protect');
const FobHandler = require('./library/fob-handler');
const FobActionMapper = require('./library/action-mapper');
const SpeakerService = require('./library/speaker-service');
//
const { stat, existsSync, unlinkSync, writeFile } = require('fs');

class UniFiProtect extends Homey.App {
    /**
     * onInit is called when the app is initialized.
     */
    async onInit() {
        this.debuggedIn = false;
        this.nvrIp = null;
        this.nvrPort = null;
        this.nvrUsername = null;
        this.nvrPassword = null;
        this.ignoreEventsNfcFingerprint = 5; // seconds
        this.ignoreEventsDoorbell = 5; // seconds
        this._refreshAuthTokensnterval = 60 * 60 * 1000; // 1 hour
        this.lastDoorAccessEvent = null;

        // Single API instance for all devices
        this.api = new ProtectAPI();
        this.api.setHomeyObject(this.homey);
        this.appProtect = new AppProtect();
        this.appProtect.setHomeyObject(this.homey);
        this.apiV2 = null;
        this.accessApi = null;
        this.appAccess = null;

        this.speakerService = new SpeakerService();
        this.speakerService.setHomeyObject(this.homey);

        this.fobHandler = new FobHandler();
        this.fobHandler.setHomeyObject(this.homey);

        this.fobActionMapper = new FobActionMapper({
            setArmMode: this._setNvrArmModeFromFob.bind(this),
            triggerAlarm: this._triggerAlarmFromFob.bind(this),
            customAction: this._runCustomFobAction.bind(this),
            sendSpeakerMessage: this.speakerService.sendSpeakerMessage.bind(this.speakerService),
        });
        this.fobActionMapper.setHomeyObject(this.homey);

        await this.appProtect.onInit();

        // Register snapshot image token
        this.appProtect._registerSnapshotToken();

        // Subscribe to credentials updates - FIXED: Store bound method for removal on uninit
        this._onSettingsChanged = this._handleSettingsChange.bind(this);
        this.homey.settings.on('set', this._onSettingsChanged);

        // set settings
        const settings = this.homey.settings.get('ufp:settings');
        if (settings) {
            this.ignoreEventsNfcFingerprint = settings.ignoreEventsNfcFingerprint || 5;
            this.ignoreEventsDoorbell = settings.ignoreEventsDoorbell || 5;
        }

        const tokens = this.homey.settings.get('ufp:tokens');
        if (tokens) {
            this.accessApiKey = tokens.accessApiKey;
            this.protectV2ApiKey = tokens.protectV2ApiKey;
        }

        if (tokens && typeof tokens.accessApiKey !== 'undefined' && tokens.accessApiKey !== '') {
            await this._initAccessStack();
            this.appAccess.loginToAccess().catch(this.error);
        }

        if (tokens && typeof tokens.protectV2ApiKey !== 'undefined' && tokens.protectV2ApiKey !== '') {
            this._initProtectV2Stack();
            this.appProtect.loginToProtectV2().catch(this.error);
        }

        // Only attempt V1 login if credentials (username/password) are configured
        const credentials = this.homey.settings.get('ufp:credentials');
        if (credentials && credentials.username && credentials.password) {
            this.appProtect._appLogin();
        }

        // refresh auth tokens every hour
        await this.appProtect.refreshAuthTokens();

        const cameraWidget = this.homey.dashboards.getWidget('camera');
        cameraWidget.registerSettingAutocompleteListener('device', async (query, settings) => {
            const cameraDevices = await this.homey.drivers.getDriver('protectcamera').getDevices();
            const returnDevices = [];
            cameraDevices.forEach((device) => {
                returnDevices.push({name: device.getName(), id: device.getData().id, driverId: 'protectcamera'});
            });
            return returnDevices;
        });

        const doorbellWidget = this.homey.dashboards.getWidget('doorbell');
        doorbellWidget.registerSettingAutocompleteListener('device', async (query, settings) => {
            const cameraDevices = await this.homey.drivers.getDriver('protectdoorbell').getDevices();
            const returnDevices = [];
            cameraDevices.forEach((device) => {
                returnDevices.push({name: device.getName(), id: device.getData().id, driverId: 'protectdoorbell'});
            });
            return returnDevices;
        });

        this._startMemoryLogging();

        this.debug('UniFiProtect has been initialized');
    }

    // FIXED: Extracted settings change handler so it can be unregistered
    async _handleSettingsChange(key) {
        try {
            if (key === 'ufp:credentials' || key === 'ufp:nvrip' || key === 'ufp:nvrport') {
                this.appProtect._appLogin();
            }
            if (key === 'ufp:settings') {
                const settings = this.homey.settings.get('ufp:settings');
                this.ignoreEventsNfcFingerprint = settings.ignoreEventsNfcFingerprint || 5;
                this.ignoreEventsDoorbell = settings.ignoreEventsDoorbell || 5;
            }
            if (key === 'ufp:tokens') {
                const tokens = this.homey.settings.get('ufp:tokens');
                if (tokens) {
                    this.accessApiKey = tokens.accessApiKey;
                    this.protectV2ApiKey = tokens.protectV2ApiKey;
                }

                if (tokens && typeof tokens.accessApiKey !== 'undefined' && tokens.accessApiKey !== '') {
                    await this._initAccessStack();
                    this.appAccess.loginToAccess().catch(this.error);
                }

                if (tokens && typeof tokens.protectV2ApiKey !== 'undefined' && tokens.protectV2ApiKey !== '') {
                    this._initProtectV2Stack();
                    this.appProtect.loginToProtectV2().catch(this.error);
                }
            }
        } catch (error) {
            this.error(error);
        }
    }

    _initProtectV2Stack() {
        if (this.apiV2) {
            return;
        }

        const ProtectAPIV2 = require('./library/protect-api-v2/protect-api');
        this.apiV2 = new ProtectAPIV2();
        this.apiV2.setHomeyObject(this.homey);
        this.homey.app.debug('[App] Initialized Protect V2 stack lazily');
    }

    async _initAccessStack() {
        if (!this.accessApi) {
            const AccessAPI = require('./library/access-api-v2/access-api');
            this.accessApi = new AccessAPI();
            this.accessApi.setHomeyObject(this.homey);
        }

        if (!this.appAccess) {
            const AppAccess = require('./library/app-access');
            this.appAccess = new AppAccess();
            this.appAccess.setHomeyObject(this.homey);
            await this.appAccess.onInit();
            this.homey.app.debug('[App] Initialized Access stack lazily');
        }
    }

    _startMemoryLogging() {
        if (Homey.env.DEBUG !== 'true') {
            return;
        }

        if (this._memoryLogInterval) {
            this.homey.clearInterval(this._memoryLogInterval);
            this._memoryLogInterval = null;
        }

        this._logMemoryUsage();
        this._memoryLogInterval = this.homey.setInterval(() => {
            this._logMemoryUsage();
        }, 30 * 60 * 1000);
    }

    _logMemoryUsage() {
        try {
            const usage = process.memoryUsage();
            const toMb = (value) => (value / (1024 * 1024)).toFixed(1);
            this.debug(
                `[memory] rss=${toMb(usage.rss)}MB heapUsed=${toMb(usage.heapUsed)}MB heapTotal=${toMb(usage.heapTotal)}MB external=${toMb(usage.external)}MB`,
            );
        } catch (error) {
            this.error(error);
        }
    }

    /**
     * Convert a Homey time to a local time
     * @param {Date} homeyTime
     * @returns {Date}
     */
    toLocalTime(homeyTime) {
        const tz = this.homey.clock.getTimezone();
        const localTime = new Date(homeyTime.toLocaleString('en-US', {timeZone: tz}));
        return localTime;
    }

    getUnixTimestamp() {
        return Math.floor(Date.now());
    }

    // FIXED: Added onUninit to clean up event listeners and intervals to prevent memory leaks
    async onUninit() {
        this.debug('UniFiProtect app is uninitialized, cleaning up...');

        // Remove settings event listener to prevent duplicate listeners on app restart
        if (this._onSettingsChanged) {
            this.homey.settings.removeListener('set', this._onSettingsChanged);
            this._onSettingsChanged = null;
        }

        // Clear refresh auth tokens interval
        if (this.appProtect && this.appProtect._refreshAuthTokensInterval) {
            this.homey.clearInterval(this.appProtect._refreshAuthTokensInterval);
            this.appProtect._refreshAuthTokensInterval = null;
        }

        // Clear access websocket check interval
        if (this.appAccess && this.appAccess._checkWebSocketConnectionInterval) {
            this.homey.clearInterval(this.appAccess._checkWebSocketConnectionInterval);
            this.appAccess._checkWebSocketConnectionInterval = null;
        }

        if (this._memoryLogInterval) {
            this.homey.clearInterval(this._memoryLogInterval);
            this._memoryLogInterval = null;
        }
    }

    onParseWebsocketMessage(payload) {
        if (payload.hasOwnProperty('type')) {

            if (payload.type === 'doorAccess') {
                if (this.appAccess && typeof this.appAccess.onDoorAccess === 'function') {
                    this.appAccess.onDoorAccess(payload);
                }
            }

        }
    }

    onFobWebsocketMessage(updatePacket) {
        try {
            const event = this.fobHandler.parseWebsocketPacket(updatePacket);
            if (!event) {
                return false;
            }

            this.homey.app.debug('[FOB] normalized event: ' + JSON.stringify(event));
            if (this.homey.app._fobButtonTrigger) {
                this.homey.app._fobButtonTrigger.trigger({
                    ufp_fob_device_id: event.deviceId,
                    ufp_fob_sensor_name: event.sensorName || event.deviceId,
                    ufp_fob_button: event.button,
                    ufp_fob_press_type: event.pressType,
                    ufp_fob_timestamp: event.timestamp,
                }, {
                    fob_device_id: event.deviceId,
                    fob_button: event.button,
                    fob_press_type: event.pressType,
                }).catch((error) => this.error(error));
            }

            if (this.homey.app._fobButtonDeviceTrigger) {
                this.homey.app._fobButtonDeviceTrigger.trigger({
                    ufp_fob_device_id: event.deviceId,
                    ufp_fob_sensor_name: event.sensorName || event.deviceId,
                    ufp_fob_button: event.button,
                    ufp_fob_press_type: event.pressType,
                    ufp_fob_timestamp: event.timestamp,
                }, {
                    fob_device_id: event.deviceId,
                    fob_button: event.button,
                    fob_press_type: event.pressType,
                }).catch((error) => this.error(error));
            }

            try {
                const fobDriver = this.homey.drivers.getDriver('protect-fob');
                const fobDevice = fobDriver.getUnifiDeviceById(event.deviceId);
                if (fobDevice) {
                    fobDevice.onFobButtonEvent(event).catch((error) => this.error(error));
                }
            } catch (error) {
                // Driver may not be paired/installed yet.
            }

            this.fobActionMapper.handleEvent(event).catch((error) => this.error(error));
            return true;
        } catch (error) {
            this.error(error);
            return false;
        }
    }

    async _setNvrArmModeFromFob(mode) {
        this.homey.app.debug('[FOB] setArmMode=' + mode);
        return this.api.setNvrArmMode(mode);
    }

    async _triggerAlarmFromFob(context) {
        this.homey.app.debug('[FOB] panic requested context=' + JSON.stringify(context || {}));

        // Keep panic implementation abstract and non-breaking for existing setups.
        if (this.api && typeof this.api.triggerAlarm === 'function') {
            return this.api.triggerAlarm(context || {});
        }

        return Promise.resolve(true);
    }

    async _runCustomFobAction(actionId, event) {
        this.homey.app.debug('[FOB] custom action=' + actionId + ' event=' + JSON.stringify(event));
        return Promise.resolve(true);
    }

    /**
     * Check if V1 API (username/password) is logged in and available
     */
    isV1Available() {
        return this.api && this.api.loggedInStatus === 'Connected';
    }

    /**
     * Check if V2 API (API key) is configured and available
     */
    isV2Available() {
        return this.apiV2 && this.apiV2.webclient && this.apiV2.webclient._apiToken;
    }

    async debug() {
        const logFile = '/userdata/application-log.log';
        if (Homey.env.DEBUG === 'true') {
            const args = Array.prototype.slice.call(arguments);
            args.unshift('[debug]');
            this.homey.log(args.join(' '));
            if (existsSync(logFile)) {
                unlinkSync(logFile);
            }
        }
        const settings = this.homey.settings.get('ufp:settings');
        if (settings && settings.saveLogToPersistentStorage) {
            stat(logFile, (err, stats) => {
                if (err) {
                    // File does not exist
                } else {
                    // When file size exceeds 25MB, delete it
                    if (stats.size >= 25 * 1024 * 1024) {
                        unlinkSync(logFile);
                    }
                }
            })
            const args = Array.prototype.slice.call(arguments);
            args.unshift('[debug]');
            // Append to log file
            writeFile(logFile, args.join(' ') + '\n', { flag: 'a+' }, err => {
                if (err) {
                    this.error(err);
                } else {
                    // file written successfully
                }
            });
        }
    }
}

module.exports = UniFiProtect;
