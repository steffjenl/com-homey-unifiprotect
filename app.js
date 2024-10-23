// eslint-disable-next-line node/no-unpublished-require,strict
'use strict';

const Homey = require('homey');
const ProtectAPI = require('./library/protectapi');
const UfvConstants = require('./library/constants');
const { Log } = require('homey-log');

// 2700000 miliseconds is 45 minutes
const RefreshCookieTime = 2700000;

class UniFiProtect extends Homey.App {
    /**
     * onInit is called when the app is initialized.
     */
    async onInit() {
        this.homeyLog = new Log({ homey: this.homey });
        this.debuggedIn = false;
        this.nvrIp = null;
        this.nvrPort = null;
        this.nvrUsername = null;
        this.nvrPassword = null;
        this.useCameraSnapshot = false;
        this._refreshAuthTokensnterval = 60 * 60 * 1000; // 1 hour

        // Single API instance for all devices
        this.api = new ProtectAPI();
        this.api.setHomeyObject(this.homey)

        // Register snapshot image token
        this._registerSnapshotToken();

        this._snapshotTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SNAPSHOT_CREATED);
        this._connectionStatusTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_CONNECTION_CHANGED);
        this._doorbellRingingTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_DOORBELL_RINGING);
        this._smartDetectionTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION);
        this._smartDetectionTriggerPerson = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_PERSON);
        this._smartDetectionTriggerVehicle = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_VEHICLE);
        this._smartDetectionTriggerAnimal = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_ANIMAL);
        this._smartDetectionTriggerPackage = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_PACKAGE);

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
                this.homey.app.api.setRecordingMode(args.device.getData(), args.recording_mode)
                    .then(this.homey.app.debug.bind(this, '[recordingmode.set]'))
                    .catch(this.error.bind(this, '[recordingmode.set]'));
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
                this.homey.app.api.setRecordingMode(args.device.getData(), args.recording_mode)
                    .then(this.homey.app.debug.bind(this, '[recordingmode.set]'))
                    .catch(this.error.bind(this, '[recordingmode.set]'));
            }
            return Promise.resolve(true);
        });

        const _setChimeVolume = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_CHIME_ONOFF);
        _setChimeVolume.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                let volume = 0;
                if (args.enabled)
                {
                    volume = args.volume;
                }
                this.homey.app.api.setChimeVolume(args.device.getData(), volume)
                    .then(this.homey.app.debug.bind(this, '[chime.volume.set]'))
                    .catch(this.error.bind(this, '[chime.volume.set]'));
            }
            return Promise.resolve(true);
        });

        const _setNightVisionMode = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_NIGHT_VISION_MODE);
        _setNightVisionMode.registerRunListener(async (args, state) => {
            if (typeof args.device.getData().id !== 'undefined') {
                this.homey.app.api.setNightVisionMode(args.device.getData(), args.nightvision_mode)
                    .then(this.homey.app.debug.bind(this, '[nightvision_mode.set]'))
                    .catch(this.error.bind(this, '[nightvision_mode.set]'));
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

        // Subscribe to credentials updates
        this.homey.settings.on('set', key => {
            if (key === 'ufp:credentials' || key === 'ufp:nvrip' || key === 'ufp:nvrport') {
                this._appLogin();
            }
            if (key === 'ufp:settings') {
                const settings = this.homey.settings.get('ufp:settings');
                this.useCameraSnapshot = settings.useCameraSnapshot;
            }
        });

        // set settings
        const settings = this.homey.settings.get('ufp:settings');
        if (settings) {
             this.useCameraSnapshot = settings.useCameraSnapshot;
        }

        this._appLogin();
        // refresh auth tokens every hour
        await this.refreshAuthTokens();

        this.debug('UniFiProtect has been initialized');
    }

    async refreshAuthTokens()    {
        const refreshAuthTokens = setInterval(() => {
            try {
                this.debug('Refreshing auth tokens');
                this._appLogin();
            } catch (error) {
                this.homey.error(`${JSON.stringify(error)}`);
            }
        }, this._refreshAuthTokensnterval);
    }

    async triggerSnapshotTrigger(tokens) {
        await this._snapshotTrigger
            .trigger(tokens)
            .catch(this.error);
    }

    async triggerConnectionStatusTrigger(tokens) {
        await this._connectionStatusTrigger
            .trigger(tokens)
            .then(this.debug)
            .catch(this.error);
    }

    async triggerDoorbellRingingTrigger(tokens) {
        await this._doorbellRingingTrigger
            .trigger(tokens)
            .then(this.debug)
            .catch(this.error);
    }

    async triggerSmartDetectionTrigger(tokens) {
        await this._smartDetectionTrigger
            .trigger(tokens)
            .then(this.debug)
            .catch(this.error);
    }

    _registerSnapshotToken() {
        // Register snapshot image token
        this.homey.flow.createToken('ufv_snapshot', {
            type: 'image',
            title: 'Snapshot',
        });
    }

    _appLogin() {
        this.debug('Logging in...');

        // Validate NVR IP address
        const nvrip = this.homey.settings.get('ufp:nvrip');
        if (!nvrip) {
            this.debug('NVR IP address not set.');
            return;
        }

        // Setting NVR Port when set
        const nvrport = this.homey.settings.get('ufp:nvrport');

        // Validate NVR credentials
        const credentials = this.homey.settings.get('ufp:credentials');
        if (!credentials) {
            this.debug('Credentials not set.');
            return;
        }

        // Log in to NVR
        this.api.login(nvrip, nvrport, credentials.username, credentials.password)
            .then(() => {
                this.api.getBootstrapInfo()
                    .then(() => {
                        this.debug('Bootstrap loaded.');
                        this.debuggedIn = true;
                        this.nvrIp = nvrip;
                        this.nvrPort = nvrport;
                        this.nvrUsername = credentials.username;
                        this.nvrPassword = credentials.password;

                        // _refreshCookie after 45 minutes
                        const timeOutFunction = function () {
                            this._refreshCookie();
                        }.bind(this);
                        this.homey.setTimeout(timeOutFunction, RefreshCookieTime);

                        this.debug('Logged in.');
                    })
                    .catch(error => this.error(error));
            })
            .catch(error => this.error(error));
    }

    _refreshCookie() {
        //if (this.debuggedIn) {
            this.api._lastUpdateId = null;

            // Validate NVR IP address
            const nvrip = this.homey.settings.get('ufp:nvrip');
            if (!nvrip) {
                this.debug('NVR IP address not set.');
                return;
            }

            // Setting NVR Port when set
            const nvrport = this.homey.settings.get('ufp:nvrport');

            // Validate NVR credentials
            const credentials = this.homey.settings.get('ufp:credentials');
            if (!credentials) {
                this.debug('Credentials not set.');
                return;
            }

            this.api.login(nvrip, nvrport, credentials.username, credentials.password)
                .then(() => {
                    this.debug('Logged in again to refresh cookie.');
                    this.api.getBootstrapInfo()
                        .then(() => {
                            this.debug('Bootstrap loaded.');
                            this.debuggedIn = true;
                        })
                        .catch(error => this.error(error));
                })
                .catch(error => this.error(error));
        //}

        // _refreshCookie after 1 hour
        const timeOutFunction = function () {
            this._refreshCookie();
        }.bind(this);
        this.homey.setTimeout(timeOutFunction, RefreshCookieTime);
    }

    /**
     * Convert a Homey time to a local time
     * @param {Date} homeyTime
     * @returns {Date}
     */
    toLocalTime(homeyTime) {
        const tz = this.homey.clock.getTimezone();
        const localTime = new Date(homeyTime.toLocaleString('en-US', { timeZone: tz }));
        return localTime;
    }

    getUnixTimestamp () {
        return Math.floor(Date.now() / 1000)
    }

    debug() {
        if (Homey.env.DEBUG === 'true') {
        const args = Array.prototype.slice.call(arguments);
        args.unshift('[debug]');
        this.homey.log(args.join(' '));
        }
    }
}

module.exports = UniFiProtect;
