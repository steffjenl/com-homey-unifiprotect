'use strict';

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
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result.data);
          }
          return reject(new Error('Error obtaining doors.'));

        })
        .catch((error) => reject(error));
    });
  }

  /**
   * Fetch all Access devices. The API returns `data` as groups of devices (one group per door/location),
   * so every group must be read, not only the first one. A flat list is accepted as well.
   */
  async _getAllDevices() {
    const response = await this.webclient.get('devices');
    const result = JSON.parse(response);
    const groups = result && Array.isArray(result.data) ? result.data : [];
    const devices = [];
    const seen = new Set();

    for (const device of groups.flat(Infinity)) {
      if (!device || typeof device !== 'object') {
        continue;
      }
      const key = String(device.unique_id || device.id || device.mac || '');
      if (key && seen.has(key)) {
        continue;
      }
      seen.add(key);
      devices.push(device);
    }
    return devices;
  }

  static _hasCapability(device, capability) {
    return Array.isArray(device.capabilities) && device.capabilities.includes(capability);
  }

  async getHubs() {
    const devices = await this._getAllDevices();
    return devices.filter((device) => AccessAPI._hasCapability(device, 'is_hub'));
  }

  async getReaders() {
    const devices = await this._getAllDevices();
    return devices.filter((device) => AccessAPI._hasCapability(device, 'is_reader'));
  }

  async getIntercoms() {
    const devices = await this._getAllDevices();
    return devices.filter((device) => AccessAPI._hasCapability(device, 'is_intercom')
      || String(device.device_type || '').toLowerCase().includes('intercom')
      || String(device.display_model || '').toLowerCase().includes('intercom')
      || String(device.model || '').toLowerCase().includes('intercom'));
  }

  async getDevice(deviceId) {
    return new Promise((resolve, reject) => {
      this.webclient.get(`devices/${deviceId}/settings`)
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error obtaining device settings.'));

        })
        .catch((error) => reject(error));
    });
  }

  async getDoor(deviceId) {
    return new Promise((resolve, reject) => {
      this.webclient.get(`doors/${deviceId}`)
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error obtaining door info.'));

        })
        .catch((error) => reject(error));
    });
  }

  async setReaderNFC(deviceId, enable) {
    return new Promise((resolve, reject) => {
      const params = {
        access_methods: {
          nfc: {
            enabled: enable ? 'yes' : 'no',
          },
        },
      };
      this.webclient.put(`devices/${deviceId}/settings`, params)
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error setting NFC enabled.'));

        })
        .catch((error) => reject(error));
    });
  }

  async setReaderWave(deviceId, enable) {
    return new Promise((resolve, reject) => {
      const params = {
        access_methods: {
          wave: {
            enabled: enable ? 'yes' : 'no',
          },
        },
      };
      this.webclient.put(`devices/${deviceId}/settings`, params)
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error obtaining readers.'));

        })
        .catch((error) => reject(error));
    });
  }

  async setReaderTouchPass(deviceId, enable) {
    return new Promise((resolve, reject) => {
      const params = {
        access_methods: {
          touch_pass: {
            enabled: enable ? 'yes' : 'no',
          },
        },
      };
      this.webclient.put(`devices/${deviceId}/settings`, params)
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error obtaining readers.'));

        })
        .catch((error) => reject(error));
    });
  }

  async setReaderMobileTap(deviceId, enable) {
    return new Promise((resolve, reject) => {
      const params = {
        access_methods: {
          bt_tap: {
            enabled: enable ? 'yes' : 'no',
          },
        },
      };
      this.webclient.put(`devices/${deviceId}/settings`, params)
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error obtaining readers.'));

        })
        .catch((error) => reject(error));
    });
  }

  async setReaderMobileButton(deviceId, enable) {
    return new Promise((resolve, reject) => {
      const params = {
        access_methods: {
          bt_button: {
            enabled: enable ? 'yes' : 'no',
          },
        },
      };
      this.webclient.put(`devices/${deviceId}/settings`, params)
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error obtaining readers.'));

        })
        .catch((error) => reject(error));
    });
  }

  async setDoorUnLock(deviceId) {
    return new Promise((resolve, reject) => {
      const params = {

      };
      this.webclient.put(`doors/${deviceId}/unlock`, params)
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error setting Door Unlock enabled.'));

        })
        .catch((error) => reject(error));
    });
  }

  async setTempDoorLockingRule(deviceId, type, interval = 1) {
    return new Promise((resolve, reject) => {
      const params = {
        type,
        interval,
      };
      this.webclient.put(`doors/${deviceId}/lock_rule`, params)
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error setting NFC enabled.'));

        })
        .catch((error) => reject(error));
    });
  }
}

module.exports = AccessAPI;
