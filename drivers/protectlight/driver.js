'use strict';

const Homey = require('homey');

class UniFiLightDriver extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    Homey.app.debug('UniFiLight Driver has been initialized');
  }

  onPair(socket) {
    // Validate NVR IP address
    socket.on('validate', (data, callback) => {
      const nvrip = Homey.ManagerSettings.get('ufp:nvrip');
      callback(null, nvrip ? 'ok' : 'nok');
    });

    // Perform when device list is shown
    socket.on('list_devices', async (data, callback) => {
      callback(null, Object.values(await Homey.app.api.getLights()).map(light => {
        return {
          data: { id: String(light.id) },
          name: light.name,
        };
      }));
    });
  }

  onParseWebsocketMessage(light, payload) {
    if (Object.prototype.hasOwnProperty.call(light, '_events')) {
      Homey.app.debug(JSON.stringify(payload));
      if (payload.hasOwnProperty('isLightOn')) {
        light.onIsLightOn(payload.isLightOn);
      }

      if (payload.hasOwnProperty('isPirMotionDetected')) {
        light.onMotionDetected(payload.lastMotion, payload.isPirMotionDetected);
      }

      if (payload.hasOwnProperty('lightDeviceSettings') && payload.lightDeviceSettings.hasOwnProperty('ledLevel')) {
        light.onLedLevelChange(payload.ledLevel);
      }

      if (payload.hasOwnProperty('lightModeSettings') && payload.lightModeSettings.hasOwnProperty('mode')) {
        light.onLightModeChange(payload.lightModeSettings);
      }
    }
  }

  getUnifiDeviceById(camera) {
    const device = this.getDevice({
      id: camera,
    });

    return device;
  }
}

module.exports = UniFiLightDriver;
