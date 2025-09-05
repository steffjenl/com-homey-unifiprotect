const BaseClient = require('./base-class');
const WebClient = require('./web-client');
const ProtectWebSocket = require('./web-socket');

class ProtectAPI extends BaseClient {
  constructor(...props) {
    super(...props);
    this.webclient = new WebClient();
    this.wsDevices = new ProtectWebSocket('devices');
    this.wsEvents = new ProtectWebSocket('events');
  }

  setSettings(host, port, apiToken) {
    this.webclient._serverHost = host;
    this.webclient._serverPort = port;
    this.webclient._apiToken = apiToken;
  }

  setHomeyObject(homey) {
    this.homey = homey;
    this.webclient.setHomeyObject(homey);
    this.wsDevices.setHomeyObject(homey);
    this.wsEvents.setHomeyObject(homey);
  }

  async getLights() {
    return new Promise((resolve, reject) => {
      this.webclient.get('lights')
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error obtaining lights.'));

        })
        .catch((error) => reject(error));
    });
  }

  async getSensors() {
    return new Promise((resolve, reject) => {
      this.webclient.get('sensors')
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error obtaining sensors.'));

        })
        .catch((error) => reject(error));
    });
  }

  async getChimes() {
    return new Promise((resolve, reject) => {
      this.webclient.get('chimes')
        .then((response) => {
          const result = JSON.parse(response);

          if (result) {
            return resolve(result);
          }
          return reject(new Error('Error obtaining chimes.'));

        })
        .catch((error) => reject(error));
    });
  }

  async getCameras() {
    return new Promise((resolve, reject) => {
      this.webclient.get('cameras')
        .then((response) => {
          const result = JSON.parse(response);

          const cameras = [];
          for (const device of result) {
            if (!device.featureFlags.smartDetectTypes.includes('package')) {
              if (!Object.hasOwn(device.lcdMessage, 'type')) {
                cameras.push(device);
              }
            }
          }

          if (cameras) {
            return resolve(cameras);
          }
          return reject(new Error('Error obtaining cameras.'));

        })
        .catch((error) => reject(error));
    });
  }

  async getDoorbells() {
    return new Promise((resolve, reject) => {
      this.webclient.get('cameras')
        .then((response) => {
          const result = JSON.parse(response);

          this.homey.app.debug(`getDoorbells: ${JSON.stringify(result)}`);

          const cameras = [];
          for (const device of result) {
            if (device.featureFlags.smartDetectTypes.includes('package')) {
              if (Object.hasOwn(device.lcdMessage, 'type')) {
                cameras.push(device);
              }
            }
          }

          if (cameras) {
            return resolve(cameras);
          }
          return reject(new Error('Error obtaining doorbells.'));

        })
        .catch((error) => reject(error));
    });
  }

  async setMicVolume(deviceId, value) {
    return new Promise((resolve, reject) => {
      this.webclient.get(`cameras/${deviceId}`).then((response) => {
        const result = JSON.parse(response);

        if (result) {
          result.micVolume = value;
          this.webclient.patch(`cameras/${deviceId}`, result)
            .then((putResponse) => {
              const putResult = JSON.parse(putResponse);
              if (putResult) {
                return resolve(putResult);
              }
              return reject(new Error('Error setting mic volume.'));
            })
            .catch((error) => reject(error));
        }
      }).catch((error) => reject(error));
    });
  }

  async setNightVisionMode(deviceId, value) {
    return new Promise((resolve, reject) => {
      this.webclient.get(`cameras/${deviceId}`).then((response) => {
        const result = JSON.parse(response);

        if (result) {
          result.nightVisionMode = value;
        }
        this.webclient.patch(`cameras/${deviceId}`, result)
        // eslint-disable-next-line consistent-return
          .then((putResponse) => {
            const putResult = JSON.parse(putResponse);
            if (putResult) {
              return resolve(putResult);
            }
          })
          .catch((error) => reject(error));
      }).catch((error) => reject(error));
    });
  }
}

module.exports = ProtectAPI;
