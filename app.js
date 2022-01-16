// eslint-disable-next-line node/no-unpublished-require,strict
'use strict';

const Homey = require('homey');
const ProtectAPI = require('./library/protectapi');
const UfvConstants = require('./library/constants');
const https = require("https");
const fetch = require("node-fetch");

const ManagerApi = Homey.api;

// 2700000 miliseconds is 45 minutes
const RefreshCookieTime = 2700000;

class UniFiProtect extends Homey.App {
    /**
     * onInit is called when the app is initialized.
     */
    async onInit() {
        this.loggedIn = false;
        this.nvrIp = null;
        this.nvrPort = null;
        this.nvrUsername = null;
        this.nvrPassword = null;

        // Enable remote debugging, if applicable
        if (Homey.env.DEBUG === 'true') {
            // eslint-disable-next-line global-require
            require('inspector')
                .open(9230, '0.0.0.0');
        }

        // Single API instance for all devices
        this.api = new ProtectAPI();
        this.api.setHomeyObject(this.homey)

        // Register snapshot image token
        this._registerSnapshotToken();

        this._snapshotTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SNAPSHOT_CREATED);
        this._connectionStatusTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_CONNECTION_CHANGED);
        this._doorbellRingingTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_DOORBELL_RINGING);
        this._smartDetectionTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION);

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

        // Subscribe to credentials updates
        this.homey.settings.on('set', key => {
            if (key === 'ufp:credentials') {
                this._appLogin();
            }
        });
        this._appLogin();


        this.debug('UniFiProtect has been initialized');
    }

    async triggerSnapshotTrigger(tokens) {
        await this._snapshotTrigger
            .trigger(tokens)
            .catch(this.error);
    }

    async triggerConnectionStatusTrigger(tokens) {
        await this._connectionStatusTrigger
            .trigger(tokens)
            .then(this.log)
            .catch(this.error);
    }

    async triggerDoorbellRingingTrigger(tokens) {
        await this._doorbellRingingTrigger
            .trigger(tokens)
            .then(this.log)
            .catch(this.error);
    }

    async triggerSmartDetectionTrigger(tokens) {
        await this._smartDetectionTrigger
            .trigger(tokens)
            .then(this.log)
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
                        this.loggedIn = true;
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
        if (this.loggedIn) {
            this.api._lastUpdateId = null;
            this.api.login(this.nvrIp, this.nvrPort, this.nvrUsername, this.nvrPassword)
                .then(() => {
                    this.debug('Logged in again to refresh cookie.');
                    this.api.getBootstrapInfo()
                        .then(() => {
                            this.log('Bootstrap loaded.');
                            this.loggedIn = true;
                        })
                        .catch(error => this.error(error));
                })
                .catch(error => this.error(error));
        }

        // _refreshCookie after 45 minutes
        const timeOutFunction = function () {
            this._refreshCookie();
        }.bind(this);
        this.homey.setTimeout(timeOutFunction, RefreshCookieTime);
    }

    _onSnapshotBuffer(cameraName, camera, width) {
        return new Promise((resolve, reject) => {
            this.homey.app.api.createSnapshotUrl(camera, width)
                .then(snapshotUrl => {
                    this.homey.app.api.getStreamUrl(camera)
                        .then(streamUrl => {
                            this._SnapshotImage = this.homey.images.createImage();
                            this._SnapshotImage.setStream(async stream => {
                                if (!snapshotUrl) {
                                    throw new Error('Invalid snapshot url.');
                                }

                                const headers = {};

                                headers['Cookie'] = this.homey.app.api.getProxyCookieToken();

                                const agent = new https.Agent({
                                    rejectUnauthorized: false,
                                    keepAlive: false,
                                });

                                // Fetch image
                                const res = await fetch(snapshotUrl, {
                                    agent,
                                    headers
                                });
                                if (!res.ok) throw new Error('Could not fetch snapshot image.');

                                return res.body.pipe(stream);
                            });

                            // get protectcamera driver
                            const driver = this.homey.drivers.getDriver('protectcamera');

                            driver.triggerSnapshotTrigger(this, {
                                ufv_snapshot_token: this._SnapshotImage,
                                ufv_snapshot_camera: cameraName,
                                ufv_snapshot_snapshot_url: this._SnapshotImage.cloudUrl,
                                ufv_snapshot_stream_url: streamUrl,
                            }, {});

                        })
                        .catch(error => reject(error));
                })
                .catch(error => reject(error));
        });
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
