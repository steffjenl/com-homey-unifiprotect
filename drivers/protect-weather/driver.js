'use strict';

const Homey = require('homey');

class WeatherDriver extends Homey.Driver {

  async onInit() {
    this.homey.app.debug('[WeatherDriver] initialized');
  }

  onPair(session) {
    const { homey } = this;

    session.setHandler('validate', async () => {
      const nvrip = homey.settings.get('ufp:nvrip');
      return (nvrip ? 'ok' : 'nok');
    });

    session.setHandler('list_devices', async () => {
      const nvrip = homey.settings.get('ufp:nvrip');
      const name = nvrip ? `UniFi Protect Weather (${nvrip})` : 'UniFi Protect Weather';
      return [
        {
          name,
          data: { id: 'protect-weather' },
          settings: { pollInterval: 15 },
        },
      ];
    });
  }

  getUnifiDeviceById(deviceId) {
    try {
      const devices = this.getDevices();
      const device = devices.find((d) => String(d.getData().id) === String(deviceId));
      return device || false;
    } catch (e) {
      return false;
    }
  }

}

module.exports = WeatherDriver;

