const BaseClass = require('../baseclass');
const WebClient = require('./web-client');
const ProtectWebSocketEvents = require('./web-socket-events');
const ProtectWebSocketDevices = require('./web-socket-devices');

class ProtectAPI extends BaseClass {
    constructor(...props) {
        super(...props);
        this.webclient = new WebClient();
        this.websocket = new ProtectWebSocketEvents();
        this.websocketDevices = new ProtectWebSocketDevices();

    }

    setSettings(host, port, apiToken) {
        this.webclient._serverHost = host;
        this.webclient._serverPort = port;
        this.webclient._apiToken = apiToken;
    }

    setHomeyObject(homey) {
        this.homey = homey;
        this.webclient.setHomeyObject(homey);
        this.websocket.setHomeyObject(homey);
        this.websocketDevices.setHomeyObject(homey);
    }

    // Cameras
    async getCameras() {
        return new Promise((resolve, reject) => {
            this.webclient.get('cameras')
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining cameras.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async getCamera(cameraId) {
        return new Promise((resolve, reject) => {
            this.webclient.get('cameras/' + cameraId)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining camera.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async getDoorbells() {
        return new Promise((resolve, reject) => {
            this.webclient.get('cameras')
                .then(response => {
                    let result = JSON.parse(response);
                    result = result.filter(obj => obj.featureFlags && obj.featureFlags.isDoorbell === true);
                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining doorbells.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async getCamerasNonDoorbell() {
        return new Promise((resolve, reject) => {
            this.webclient.get('cameras')
                .then(response => {
                    let result = JSON.parse(response);
                    result = result.filter(obj => !obj.featureFlags || obj.featureFlags.isDoorbell !== true);
                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining cameras.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async setCamera(cameraId, params) {
        return new Promise((resolve, reject) => {
            this.webclient.patch('cameras/' + cameraId, params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error setting camera.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    // Lights
    async getLights() {
        return new Promise((resolve, reject) => {
            this.webclient.get('lights')
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining lights.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async getLight(lightId) {
        return new Promise((resolve, reject) => {
            this.webclient.get('lights/' + lightId)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining light.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async setLight(lightId, params) {
        return new Promise((resolve, reject) => {
            this.webclient.patch('lights/' + lightId, params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error setting light.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    // Relays
    async getRelays() {
        return new Promise((resolve, reject) => {
            this.webclient.get('relays')
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining relays.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async getRelay(relayId) {
        return new Promise((resolve, reject) => {
            this.webclient.get('relays/' + relayId)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining relay.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async setRelayOutputState(relayId, outputId, isOn) {
        return new Promise((resolve, reject) => {
            this.getRelay(relayId)
                .then((relay) => {
                    if (!relay || !Array.isArray(relay.outputs)) {
                        return reject(new Error('Relay outputs not found.'));
                    }

                    let outputFound = false;
                    const outputIdString = String(outputId);
                    const outputs = relay.outputs.map((output) => {
                        if (String(output.id) !== outputIdString) {
                            return output;
                        }

                        outputFound = true;
                        return Object.assign({}, output, {
                            state: isOn ? 'on' : 'off'
                        });
                    });

                    if (!outputFound) {
                        return reject(new Error(`Relay output ${outputId} not found.`));
                    }

                    return this.webclient.patch('relays/' + relayId, { outputs })
                        .then(response => {
                            let result = response;
                            if (result) {
                                return resolve(result);
                            }
                            return reject(new Error('Error setting relay output.'));
                        })
                        .catch(error => reject(error));
                })
                .catch(error => reject(error));
        });
    }

    async pulseRelayOutput(relayId, outputId, pulseDuration = 1000) {
        return new Promise((resolve, reject) => {
            const duration = Number(pulseDuration);
            const safeDuration = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 1000;

            this.webclient.post(`relays/${relayId}/outputs/${outputId}/activate`, { pulseDuration: safeDuration })
                .then(response => resolve(response || 'Relay output successfully pulsed.'))
                .catch(error => reject(error));
        });
    }

    // Sensors
    async getSensors() {
        return new Promise((resolve, reject) => {
            this.webclient.get('sensors')
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining sensors.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async getSensor(sensorId) {
        return new Promise((resolve, reject) => {
            this.webclient.get('sensors/' + sensorId)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining sensor.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async setSensor(sensorId, params) {
        return new Promise((resolve, reject) => {
            this.webclient.patch('sensors/' + sensorId, params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error setting sensor.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    // Chimes
    async getChimes() {
        return new Promise((resolve, reject) => {
            this.webclient.get('chimes')
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining chimes.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async getChime(chimeId) {
        return new Promise((resolve, reject) => {
            this.webclient.get('chimes/' + chimeId)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining chime.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async setChime(chimeId, params) {
        return new Promise((resolve, reject) => {
            this.webclient.patch('chimes/' + chimeId, params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error setting chime.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    // Snapshot
    getSnapshotUrl(cameraId, highQuality = false) {
        const host = this.webclient._serverHost;
        const port = this.webclient._serverPort;
        const quality = highQuality ? 'true' : 'false';
        const path = this.webclient.buildApiPath(`cameras/${cameraId}/snapshot`, { highQuality: quality });
        return `https://${host}:${port}${path}`;
    }

    getSnapshotHeaders() {
        return {
            'X-API-KEY': this.webclient._apiToken,
        };
    }

    async getSnapshot(cameraId) {
        return new Promise((resolve, reject) => {
            this.webclient.get(`cameras/${cameraId}/snapshot`, {}, true)
                .then(buffer => resolve(buffer))
                .catch(error => reject(error));
        });
    }

    // RTSPS Streams
    async getRtspsStream(cameraId, qualities = ['high']) {
        return new Promise((resolve, reject) => {
            this.webclient.post(`cameras/${cameraId}/rtsps-stream`, { qualities })
                .then(response => {
                    let result = JSON.parse(response);
                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error creating RTSPS stream.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    async getExistingRtspsStream(cameraId) {
        return new Promise((resolve, reject) => {
            this.webclient.get(`cameras/${cameraId}/rtsps-stream`)
                .then(response => {
                    let result = JSON.parse(response);
                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining RTSPS stream.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    // NVR
    async getNVR() {
        return new Promise((resolve, reject) => {
            this.webclient.get('nvrs')
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining chimes.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

}

module.exports = ProtectAPI;
