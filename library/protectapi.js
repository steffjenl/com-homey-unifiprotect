'use strict';

const BaseClass = require('./baseclass');
const https = require('https');
const ProtectWebClient = require('./webclient');
const ProtectWebSocket = require('./websocket');
const UfvConstants = require('./constants');

let UFV_API_ENDPOINT = '/proxy/protect/api';

class ProtectAPI extends BaseClass {

    constructor(...props) {
        super(...props);
        // Single WebSocket instance for all devices
        this.ws = new ProtectWebSocket();
        this.webclient = new ProtectWebClient();
        this._bootstrap = null;
        this._lastUpdateId = null;
        this._rtspPort = null;
        this.homey = null;
        this.loggedInStatus = 0;
        this.lastWebsocketMessage = null;
    }

    setHomeyObject(homey) {
        this.homey = homey;
        this.ws.setHomeyObject(this.homey);
        this.webclient.setHomeyObject(this.homey);
    }

    getProxyCookieToken() {
        return this.webclient.getCookieToken();
    }

    getHost() {
        return this.webclient.getServerHost();
    }

    getLastUpdateId() {
        return this._lastUpdateId;
    }

    getBootstrap() {
        return this._bootstrap;
    }

    getNvrName() {
        if (typeof this._bootstrap.nvr.name !== 'undefined' && this._bootstrap.nvr.name !== null) {
            return this._bootstrap.nvr.name;
        }
        if (typeof this._bootstrap.nvr.host !== 'undefined' && this._bootstrap.nvr.host !== null) {
            return this._bootstrap.nvr.host;
        }
        if (typeof this._bootstrap.nvr.id !== 'undefined' && this._bootstrap.nvr.id !== null) {
            return this._bootstrap.nvr.id;
        }

    }

    getCSRFToken(host, port) {
        this.homey.app.debug('Get CSRF Token...');

        return new Promise((resolve, reject) => {
            //this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Getting CSRF token');
            //this.loggedInStatus = 'Getting CSRF token';

            if (!host) reject(new Error('Invalid host.'));

            const options = {
                method: 'GET',
                hostname: host,
                port: port,
                path: '/',
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    Accept: '*/*',
                    'x-csrf-token': 'undefined'
                },
                maxRedirects: 20,
                rejectUnauthorized: false,
                timeout: 2000,
                keepAlive: true,
            };

            const req = https.request(options, res => {
                const body = [];

                res.on('data', chunk => body.push(chunk));
                res.on('end', () => {
                    // Obtain authorization header
                    res.rawHeaders.forEach((item, index) => {
                        if (item.toLowerCase() === 'set-cookie') {
                            this.webclient.setCookieToken(res.rawHeaders[index + 1]);
                        }

                        // X-CSRF-Token
                        if (item.toLowerCase() === 'x-csrf-token') {
                            this.webclient.setCSRFToken(res.rawHeaders[index + 1]);
                        }

                        // this.homey.app.debug('Header: ' + item.toLowerCase() + ' => ' + res.rawHeaders[index + 1]);
                    });

                    // Connected
                    //this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'CSRF Token found');
                    //this.loggedInStatus = 'CSRF Token found';
                    //
                    return resolve(this.webclient.getCSRFToken());
                });
            });

            req.on('error', error => {
                this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Disconnected');
                this.loggedInStatus = 'Disconnected';
                return reject(error);
            });
            req.end();
        });
    }

    login(host, port, username, password) {
        this.homey.app.debug('Logging in...');
        UFV_API_ENDPOINT = '/proxy/protect/api';

        this.webclient.setServerHost(host);
        this.webclient.setServerPort(port);

        return new Promise((resolve, reject) => {

            //this.getCSRFToken(host, port).then(response => {

                this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Connecting');
                this.loggedInStatus = 'Connecting';

                if (!host) reject(new Error('Invalid host.'));
                if (!username) reject(new Error('Invalid username.'));
                if (!password) reject(new Error('Invalid password.'));

                const credentials = JSON.stringify({
                    username,
                    password,
                });

                const options = {
                    method: 'POST',
                    hostname: host,
                    port: port,
                    path: '/api/auth/login',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        Accept: 'application/json',
                    },
                    maxRedirects: 20,
                    rejectUnauthorized: false,
                    timeout: 2000,
                    keepAlive: true,
                };

                const req = https.request(options, res => {
                    if (res.statusCode !== 200) {
                        return reject(new Error(`Request failed: ${options.path} (status code: ${res.statusCode}) (creds: ${credentials}`));
                    }
                    const body = [];

                    res.on('data', chunk => body.push(chunk));
                    res.on('end', () => {
                        if (res.statusCode !== 200) {
                            return reject(new Error(`Request failed: ${options.path} (status code: ${res.statusCode})`));
                        }

                        // Obtain authorization header
                        res.rawHeaders.forEach((item, index) => {
                            if (item.toLowerCase() === 'set-cookie') {
                                this.webclient.setCookieToken(res.rawHeaders[index + 1]);
                            }

                            // X-CSRF-Token
                            if (item.toLowerCase() === 'x-csrf-token') {
                                this.webclient.setCSRFToken(res.rawHeaders[index + 1]);
                            }
                        });

                        if (this.webclient.getCookieToken() === null) {
                            reject(new Error('Invalid set-cookie header.'));
                            return;
                        }

                        // Connected
                        this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Connected');
                        this.loggedInStatus = 'Connected';
                        //
                        return resolve('Logged in...');
                    });
                });

                req.on('error', error => {
                    this.homey.api.realtime(UfvConstants.EVENT_SETTINGS_STATUS, 'Disconnected');
                    this.loggedInStatus = 'Disconnected';
                    return reject(error);
                });

                req.write(credentials);
                req.end();

            }).catch(error => this.homey.error(error));
    }

    getBootstrapInfo() {
        return new Promise((resolve, reject) => {
            console.log('Getting bootstrap info...');
            this.webclient.get('bootstrap')
                .then(response => {
                    const result = JSON.parse(response);
                    console.log('Bootstrap info obtained.');

                    if (result) {
                        console.log('Setting bootstrap info...');
                        this._bootstrap = result;

                        if (result.cameras) {
                            console.log('Setting API key...');
                            this._rtspPort = result.nvr.ports.rtsp;
                            this._lastUpdateId = result.lastUpdateId;

                            if (this.ws.isWebsocketConnected() === false) {
                                console.log('Connecting to websocket...');
                                // lastUpdateId is changed, please reconnect to websocket when websocket is disconnected.
                                this.ws.reconnectUpdatesListener();
                            }
                        }

                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining bootstrap info.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    getAccessKey() {
        return new Promise((resolve, reject) => {
            this.webclient.post('auth/access-key')
                .then(response => {
                    const result = JSON.parse(response);
                    this.webclient.setApiKey(result.accessKey);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining access-key.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    getDebugInfo() {
        return new Promise((resolve, reject) => {
            this.webclient.get('debug/info')
                .then(response => {
                    const result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining server.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    getServer() {
        return new Promise((resolve, reject) => {
            this.webclient.get('nvr')
                .then(response => {
                    const result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining server.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    findCameraById(id) {
        return new Promise((resolve, reject) => {
            this.webclient.get(`cameras/${id}`)
                .then(response => {
                    const result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining cameras.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    getCameras() {
        return new Promise((resolve, reject) => {
            this.webclient.get('cameras')
                .then(response => {
                    let result = JSON.parse(response);
                    result = result.filter(obj => obj.featureFlags.isDoorbell !== true);
                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining cameras.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    getDoorbells() {
        return new Promise((resolve, reject) => {
            this.webclient.get('cameras')
                .then(response => {
                    let result = JSON.parse(response);
                    result = result.filter(obj => obj.featureFlags.isDoorbell === true);
                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining cameras.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    snapshot(id, widthInPixels = 1920) {
        return new Promise((resolve, reject) => {
            if (!id) reject(new Error('Invalid camera identifier.'));

            const height = this.getAspectRatioHeight(id, widthInPixels);

            const params = {
                accessKey: this.webclient.getApiKey(),
                w: widthInPixels,
                force: true,
                ext: '.jpg'
            };

            let snapshot;
            return this.webclient.download(`cameras/${id}/snapshot`, params)
                .then(buffer => resolve(buffer))
                .catch(error => reject(new Error(`Error obtaining snapshot buffer: ${error}`)));
        });
    }

    createSnapshotUrl(camera, widthInPixels = 1920, useCameraSnapshotUrl = false) {
        return new Promise((resolve, reject) => {
            if (!this.webclient.getServerHost()) reject(new Error('Invalid host.'));
            if (!camera) reject(new Error('Invalid camera'));

            const params = {
                accessKey: this.webclient.getApiKey(),
                w: widthInPixels,
                force: true,
                ts: Date.now(),
                ext: '.jpg'
            };

            return resolve(`https://${this.webclient.getServerHost()}:${this.webclient.getServerPort()}${UFV_API_ENDPOINT}/cameras/${camera.id}/snapshot${this.webclient.toQueryString(params)}`);
        });
    }

    createPackageSnapshotUrl(camera, widthInPixels = 1920, useCameraSnapshotUrl = false) {
        return new Promise((resolve, reject) => {
            if (!this.webclient.getServerHost()) reject(new Error('Invalid host.'));
            if (!camera) reject(new Error('Invalid camera'));

            const params = {
                accessKey: this.webclient.getApiKey(),
                w: widthInPixels,
                force: true,
                ts: Date.now(),
                ext: '.jpg'
            };

            return resolve(`https://${this.webclient.getServerHost()}:${this.webclient.getServerPort()}${UFV_API_ENDPOINT}/cameras/${camera.id}/package-snapshot${this.webclient.toQueryString(params)}`);
        });
    }

    setRecordingMode(camera, mode = 'never') {
        return new Promise((resolve, reject) => {
            this.findCameraById(camera.id)
                .then(cameraInfo => {
                    const recordingSettings = cameraInfo.recordingSettings;
                    const channels = cameraInfo.channels;
                    recordingSettings.mode = mode;

                    const params = {
                        channels,
                        recordingSettings
                    };

                    return this.webclient.patch(`cameras/${camera.id}`, params)
                        .then(() => resolve('Recording mode successfully set.'))
                        .catch(error => reject(new Error(`Error setting recording mode: ${error}`)));
                })
                .catch(error => reject(new Error(`Error setting recording mode: ${error}`)));
        });
    }

    setNightVisionMode(camera, mode = 'auto') {
        return new Promise((resolve, reject) => {
            this.findCameraById(camera.id)
                .then(cameraInfo => {
                    const params = {
                        ispSettings: {
                            irLedMode: mode
                        }
                    }

                    return this.webclient.patch(`cameras/${camera.id}`, params)
                        .then(() => resolve('Night Vision mode successfully set.'))
                        .catch(error => reject(new Error(`Error setting Night Vision mode: ${error}`)));
                })
                .catch(error => reject(new Error(`Error setting Night Vision mode: ${error}`)));
        });
    }

    setMicVolume(camera, volume = 100) {
        return new Promise(async (resolve, reject) => {
            const params = {
                micVolume: volume,
            };
            try {
                await this.webclient.patch(`cameras/${camera.id}`, params);
                return resolve('Mic volume successfully set.');
            } catch (error) {
                return reject(new Error(`Error setting mic volume: ${error}`));
            }
        });
    }

    setCameraBlackout(camera, enabled) {
        /*
        {"privacyZones":[{"id":1,"name":"New Zone","color":"#5a6cea","points":[[0.002336448598130841,0.004155124653739612],[0.49221184989002265,0],[0.48831772135796947,0.03670364337614699],[0,0.22506933661378983]],"update":false,"uniqueId":"privacyZones-1"},{"id":2,"name":"New Privacy Blackout 001","color":"#586CED","points":[[0,0],[1,0],[1,1],[0,1]],"isTriggerLightEnabled":false,"direction":null,"uniqueId":"privacyZones-2","mergeId":null,"objectTypes":[],"sensitivity":null,"loiterTriggers":[],"quality":null,"isTargetCounting":null,"plan":null,"originalType":null,"zoneIds":null}]}
         */
        return new Promise((resolve, reject) => {
            this.findCameraById(camera.id)
                .then(cameraInfo => {
                    this.homey.app.debug('Current privacy zones: ' + JSON.stringify(cameraInfo.privacyZones));
                    const privacyZones = cameraInfo.privacyZones;
                    if (enabled) {
                        // Add blackout zone
                        if (privacyZones.filter(zone => zone.name === 'Homey Blackout Zone').length === 0) {
                            const newZone = {
                                id: privacyZones.length + 1,
                                name: 'Homey Blackout Zone',
                                color: '#586CED',
                                points: [
                                    [0, 0],
                                    [1, 0],
                                    [1, 1],
                                    [0, 1]
                                ],
                                isTriggerLightEnabled: false,
                                direction: null,
                                uniqueId: `privacyZones-${privacyZones.length + 1}`,
                                mergeId: null,
                                objectTypes: [],
                                sensitivity: null,
                                loiterTriggers: [],
                                quality: null,
                                isTargetCounting: null,
                                plan: null,
                                originalType: null,
                                zoneIds: null
                            };
                            privacyZones.push(newZone);
                        }
                    } else {
                        // Remove blackout zone
                        const index = privacyZones.findIndex(zone => zone.name === 'Homey Blackout Zone');
                        if (index !== -1) {
                            privacyZones.splice(index, 1);
                        }
                    }

                    const params = {
                        privacyZones
                    };

                    this.homey.app.debug('Updated privacy zones: ' + JSON.stringify(privacyZones));

                    return this.webclient.patch(`cameras/${camera.id}`, params)
                        .then(() => resolve('Blackout mode successfully set.'))
                        .catch(error => reject(new Error(`Error setting Blackout mode: ${error}`)));
                })
                .catch(error => reject(new Error(`Error setting Blackout mode: ${error}`)));
        });
    }

    setLCDMessage(camera, message = '', resetAt = null) {
        return new Promise((resolve, reject) => {
            const params = {
                lcdMessage: {
                    type: "CUSTOM_MESSAGE",
                    text: message,
                    resetAt: resetAt
                },
            };
            return this.webclient.patch(`cameras/${camera.id}`, params)
                .then(() => resolve('LCD message successfully set.'))
                .catch(error => reject(new Error(`Error setting lcd message: ${error}`)));
        });
    }

    getMotionEvents() {
        return new Promise((resolve, reject) => {
            let start = new Date();
            start.setHours(0, 0, 0, 0);
            let end = new Date();
            end.setHours(23, 59, 59, 999);

            let startTime = (this._lastMotionAt == null ? start.getTime() : this._lastMotionAt);

            this.webclient.get(`events?start=${startTime}&end=${end.getTime()}&type=motion`)
                .then(response => {
                    start = null;
                    end = null;
                    startTime = null;
                    const result = JSON.parse(response);
                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining motion events.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    getAspectRatioHeight(cameraId, widthInPixels) {
        this._bootstrap.cameras.forEach(camera => {
            if (camera.id === cameraId) {
                if (camera.type === 'UVC G4 Doorbell') {
                    return widthInPixels / 4 * 3;
                } else {
                    return widthInPixels / 16 * 9;
                }
            }
        });
    }

    getStreamUrl(camera) {
        return new Promise((resolve, reject) => {
            let rtspAlias = null;

            this.findCameraById(camera.id)
                .then(cameraInfo => {
                    cameraInfo.channels.forEach(channel => {
                        if (channel.isRtspEnabled) {
                            rtspAlias = channel.rtspAlias;
                        }
                    });

                    if (!rtspAlias) {
                        resolve('');
                    }

                    resolve(`rtsp://${this.webclient.getServerHost()}:${this._rtspPort}/${rtspAlias}`);
                })
                .catch(error => reject(new Error(`Error getting steam url: ${error}`)));
        });
    }

    getPackageStreamUrl(camera) {
        return new Promise((resolve, reject) => {
            let rtspAlias = null;

            this.findCameraById(camera.id)
                .then(cameraInfo => {
                    cameraInfo.channels.forEach(channel => {
                        if (channel.isRtspEnabled && channel.name === 'Package Camera') {
                            rtspAlias = channel.rtspAlias;
                        }
                    });

                    if (!rtspAlias) {
                        resolve('');
                    }

                    resolve(`rtsp://${this.webclient.getServerHost()}:${this._rtspPort}/${rtspAlias}`);
                })
                .catch(error => reject(new Error(`Error getting steam url: ${error}`)));
        });
    }

    findLightById(id) {
        return new Promise((resolve, reject) => {
            this.webclient.get(`lights/${id}`)
                .then(response => {
                    const result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining lights.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    getChimes() {
        return new Promise((resolve, reject) => {
            this.webclient.get('chimes')
                .then(response => {
                    const result = JSON.parse(response);
                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining chimes.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    setChimeVolume(chime, volumeLevel) {
        return new Promise((resolve, reject) => {
            const params = {
                volume: volumeLevel * 100
            };
            return this.webclient.patch(`chimes/${chime.id}`, params)
                .then(() => resolve('volume successfully set.'))
                .catch(error => reject(new Error(`Error setting volume: ${error}`)));
        });
    }

    getLights() {
        return new Promise((resolve, reject) => {
            this.webclient.get('lights')
                .then(response => {
                    const result = JSON.parse(response);
                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining lights.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    setLightOn(light, isLightOn) {
        return new Promise((resolve, reject) => {
            const isLedForceOn = {
                isLedForceOn: isLightOn
            }
            const params = {
                isLightOn: isLightOn,
                lightOnSettings: isLedForceOn
            };
            return this.webclient.patch(`lights/${light.id}`, params)
                .then(() => resolve('isLightOn successfully set.'))
                .catch(error => reject(new Error(`Error setting isLightOn: ${error}`)));
        });
    }

    setLightLevel(light, ledLevel) {
        this.homey.app.debug(ledLevel);
        return new Promise((resolve, reject) => {
            const isLedForceOn = {
                ledLevel: ledLevel
            }
            const params = {
                lightDeviceSettings: isLedForceOn
            };
            return this.webclient.patch(`lights/${light.id}`, params)
                .then(() => resolve('setLightLevel successfully set.'))
                .catch(error => reject(new Error(`Error setting setLightLevel: ${error}`)));
        });
    }

    setLightMode(light, mode) {
        this.homey.app.debug(mode);
        return new Promise((resolve, reject) => {
            let lightModeSettings = {}
            if (mode === "motion") {
                lightModeSettings = {
                    mode: "motion",
                    enableAt: "fulltime"

                }
            } else if (mode === "dark") {
                lightModeSettings = {
                    mode: "motion",
                    enableAt: "dark"

                }
            } else {
                lightModeSettings = {
                    mode: mode,
                    enableAt: 'dark'

                }
            }
            const params = {
                lightModeSettings: lightModeSettings
            };
            return this.webclient.patch(`lights/${light.id}`, params)
                .then(() => resolve('setLightMode successfully set.'))
                .catch(error => reject(new Error(`Error setting setLightMode: ${error}`)));
        });
    }

    getSensors() {
        return new Promise((resolve, reject) => {
            this.webclient.get('sensors')
                .then(response => {
                    const result = JSON.parse(response);
                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining sensors.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    getUsers() {
        return new Promise((resolve, reject) => {
        this.getBootstrapInfo()
            .then((result) => {
                return resolve(result.users);
            })
            .catch(error => this.error(error));
        });
    }

    getCloudUsers() {
        return new Promise((resolve, reject) => {
            const params = {
                page_num: 1,
                page_size: 200
            }
            this.webclient.get('users/api/v2/users/search', params, false, true)
                .then(response => {
                    const result = JSON.parse(response);
                    return resolve(result.data);
                })
                .catch(error => reject(error));
        });
    }

    getUsernameById(id) {
        return new Promise((resolve, reject) => {
            this.getUsers()
                .then(users => {
                    const user = users.find(user => user.id === id);
                    return resolve(user.localUsername);
                })
                .catch(error => reject(error));
        });
    }

    getCloudUsernameById(id) {
        return new Promise((resolve, reject) => {
            this.getCloudUsers()
                .then(users => {
                    const user = users.find(user => user.unique_id === id);
                    return resolve(user.email !== "" ? user.email : user.username);
                })
                .catch(error => reject(error));
        });
    }

    getCloudUserById(id) {
        return new Promise((resolve, reject) => {
            this.getCloudUsers()
                .then(users => {
                    const user = users.find(user => user.unique_id === id);
                    return resolve(user);
                })
                .catch(error => reject(error));
        });
    }

    setStatusLed(camera, enabled) {
        return new Promise((resolve, reject) => {
            const params = {
                ledSettings: {
                    isEnabled: enabled
                }
            };
            return this.webclient.patch(`cameras/${camera.id}`, params)
                .then(() => resolve('Status Led successfully set.'))
                .catch(error => reject(new Error(`Error setting status led: ${error}`)));
        });
    }

    setStatusSound(camera, enabled) {
        return new Promise((resolve, reject) => {
            const params = {
                speakerSettings: {
                    areSystemSoundsEnabled: enabled
                }
            };
            return this.webclient.patch(`cameras/${camera.id}`, params)
                .then(() => resolve('Status Sound successfully set.'))
                .catch(error => reject(new Error(`Error setting status sound: ${error}`)));
        });
    }
}

module.exports = ProtectAPI;
