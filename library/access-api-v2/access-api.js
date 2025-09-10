const BaseClient = require('./base-class');
const WebClient = require('./web-client');
const AccessWebSocket = require('./web-socket');

class AccessAPI extends BaseClient {
    constructor(...props) {
        super(...props);
        this.webclient = new WebClient();
        this.websocket = new AccessWebSocket();
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
    }

    async getDoors() {
        return new Promise((resolve, reject) => {
            this.webclient.get('doors')
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result.data);
                    } else {
                        return reject(new Error('Error obtaining doors.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    async getHubs() {
        return new Promise((resolve, reject) => {
            this.webclient.get('devices')
                .then(response => {
                    let result = JSON.parse(response);

                    let hubs = [];
                    for (const device of result.data[0]) {
                        if (device.capabilities.includes('is_hub')) {
                            hubs.push(device);
                        }
                    }

                    if (hubs) {
                        return resolve(hubs);
                    } else {
                        return reject(new Error('Error obtaining hubs.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    async getReaders() {
        return new Promise((resolve, reject) => {
            this.webclient.get('devices')
                .then(response => {
                    let result = JSON.parse(response);

                    let readers = [];
                    for (const device of result.data[0]) {
                        if (device.capabilities.includes('is_reader')) {
                            readers.push(device);
                        }
                    }

                    if (readers) {
                        return resolve(readers);
                    } else {
                        return reject(new Error('Error obtaining readers.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    async getDevice(deviceId) {
        return new Promise((resolve, reject) => {
            this.webclient.get('devices/' + deviceId + '/settings')
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining device settings.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async getDoor(deviceId) {
        return new Promise((resolve, reject) => {
            this.webclient.get('doors/' + deviceId)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining door info.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    async setReaderNFC(deviceId, enable) {
        return new Promise((resolve, reject) => {
            const params = {
                access_methods: {
                    nfc: {
                        enabled: enable ? 'yes' : 'no'
                    }
                }
            };
            this.webclient.put('devices/' + deviceId + '/settings', params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error setting NFC enabled.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    async setReaderWave(deviceId, enable) {
        return new Promise((resolve, reject) => {
            const params = {
                access_methods: {
                    wave: {
                        enabled: enable ? 'yes' : 'no'
                    }
                }
            };
            this.webclient.put('devices/' + deviceId + '/settings', params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining readers.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    async setReaderTouchPass(deviceId, enable) {
        return new Promise((resolve, reject) => {
            const params = {
                access_methods: {
                    touch_pass: {
                        enabled: enable ? 'yes' : 'no'
                    }
                }
            };
            this.webclient.put('devices/' + deviceId + '/settings', params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining readers.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    async setReaderMobileTap(deviceId, enable) {
        return new Promise((resolve, reject) => {
            const params = {
                access_methods: {
                    bt_tap: {
                        enabled: enable ? 'yes' : 'no'
                    }
                }
            };
            this.webclient.put('devices/' + deviceId + '/settings', params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining readers.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    async setReaderMobileButton(deviceId, enable) {
        return new Promise((resolve, reject) => {
            const params = {
                access_methods: {
                    bt_button: {
                        enabled: enable ? 'yes' : 'no'
                    }
                }
            };
            this.webclient.put('devices/' + deviceId + '/settings', params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error obtaining readers.'));
                    }
                })
                .catch(error => reject(error));
        });
    }

    async setDoorUnLock(deviceId) {
        return new Promise((resolve, reject) => {
            const params = {

            };
            this.webclient.put('doors/' + deviceId + '/unlock', params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error setting Door Unlock enabled.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
    async setTempDoorLockingRule(deviceId, type, interval = 1) {
        return new Promise((resolve, reject) => {
            const params = {
                type: type,
                interval: interval
            };
            this.webclient.put('doors/' + deviceId + '/lock_rule', params)
                .then(response => {
                    let result = JSON.parse(response);

                    if (result) {
                        return resolve(result);
                    } else {
                        return reject(new Error('Error setting NFC enabled.'));
                    }
                })
                .catch(error => reject(error));
        });
    }
}

module.exports = AccessAPI;
