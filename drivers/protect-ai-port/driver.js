'use strict';

const Homey = require('homey');

class UniFiAiPortDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.debug('UniFiAiPort Driver has been initialized');
  }

  onPair(session) {
    const homey = this.homey;

    session.setHandler('validate', async function () {
      const nvrip = homey.settings.get('ufp:nvrip');
      return (nvrip ? 'ok' : 'nok');
    });

    session.setHandler('list_devices', async function () {
      const bootstrap = homey.app.api.getBootstrap();
      if (!bootstrap || !Array.isArray(bootstrap.aiports)) {
        return [];
      }

      return bootstrap.aiports.map((aiport) => ({
        data: { id: String(aiport.id) },
        name: aiport.name || aiport.displayName || 'AI Port',
      }));
    });
  }

  onParseWebsocketMessage(device, payload) {
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onAiPortUpdate(payload);
    }
  }

  getUnifiDeviceById(deviceId) {
    try {
      const devices = this.getDevices();
      const device = devices.find((device) => String(device.getData().id) === String(deviceId));
      if (!device) return false;
      return device;
    } catch (error) {
      return false;
    }
  }
}

module.exports = UniFiAiPortDriver;
