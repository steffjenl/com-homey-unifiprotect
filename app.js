// eslint-disable-next-line node/no-unpublished-require,strict

'use strict';

const Homey = require('homey');
const {Log} = require('homey-log');
const ProtectAPI = require('./library/protectapi');
const AppAccess = require('./library/app-access');
const AppProtect = require('./library/app-protect');
const AccessAPI = require('./library/access-api-v2/access-api');
const ProtectAPIV2 = require('./library/protect-api-v2/protect-api');
//
const { stat, createWriteFile, existsSync, mkdirSync, rmSync, unlinkSync, readdirSync, statSync, readFileSync, openSync, readSync, closeSync, writeFileSync, writeFile } = require("fs");

class UniFiProtect extends Homey.App {
    /**
     * onInit is called when the app is initialized.
     */
    async onInit() {
        this.homeyLog = new Log({homey: this.homey});
        this.debuggedIn = false;
        this.nvrIp = null;
        this.nvrPort = null;
        this.nvrUsername = null;
        this.nvrPassword = null;
        this.useCameraSnapshot = false;
        this.ignoreEventsNfcFingerprint = 5; // seconds
        this.ignoreEventsDoorbell = 5; // seconds
        this._refreshAuthTokensnterval = 60 * 60 * 1000; // 1 hour
        this.lastDoorAccessEvent = null;

        // Single API instance for all devices
        this.api = new ProtectAPI();
        this.api.setHomeyObject(this.homey);
        this.appProtect = new AppProtect();
        this.appProtect.setHomeyObject(this.homey);
        this.apiV2 = new ProtectAPIV2();
        this.apiV2.setHomeyObject(this.homey);
        //
        this.accessApi = new AccessAPI();
        this.accessApi.setHomeyObject(this.homey);
        this.appAccess = new AppAccess();
        this.appAccess.setHomeyObject(this.homey);

        await this.appProtect.onInit();
        await this.appAccess.onInit();

        // Register snapshot image token
        this.appProtect._registerSnapshotToken();

        // Subscribe to credentials updates
        this.homey.settings.on('set', (key) => {
            if (key === 'ufp:credentials' || key === 'ufp:nvrip' || key === 'ufp:nvrport') {
                this.appProtect._appLogin();
            }
            if (key === 'ufp:settings') {
                const settings = this.homey.settings.get('ufp:settings');
                this.useCameraSnapshot = settings.useCameraSnapshot;
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
                    this.appAccess.loginToAccess().catch(this.error);
                }

                if (tokens && typeof tokens.protectV2ApiKey !== 'undefined' && tokens.protectV2ApiKey !== '') {
                    this.appProtect.loginToProtectV2().catch(this.error);
                }
            }
        });

        // set settings
        const settings = this.homey.settings.get('ufp:settings');
        if (settings) {
            this.useCameraSnapshot = settings.useCameraSnapshot;
            this.ignoreEventsNfcFingerprint = settings.ignoreEventsNfcFingerprint || 5;
            this.ignoreEventsDoorbell = settings.ignoreEventsDoorbell || 5;
        }

        const tokens = this.homey.settings.get('ufp:tokens');
        if (tokens) {
            this.accessApiKey = tokens.accessApiKey;
            this.protectV2ApiKey = tokens.protectV2ApiKey;
        }

        if (tokens && typeof tokens.accessApiKey !== 'undefined' && tokens.accessApiKey !== '') {
            this.appAccess.loginToAccess().catch(this.error);
        }

        if (tokens && typeof tokens.protectV2ApiKey !== 'undefined' && tokens.protectV2ApiKey !== '') {
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

        this.debug('UniFiProtect has been initialized');
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

    onParseWebsocketMessage(payload) {
        if (payload.hasOwnProperty('type')) {

            if (payload.type === 'doorAccess') {
                this.appAccess.onDoorAccess(payload);
            }

        }
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
