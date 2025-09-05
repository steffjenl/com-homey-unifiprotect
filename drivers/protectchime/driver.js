'use strict';

const Homey = require('homey');

class UniFiChimeDriver extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    this.homey.app.debug('UniFiChime Driver has been initialized');
  }

  onPair(session) {
    const { homey } = this;
    session.setHandler('validate', async (data) => {
      const nvrsettings = homey.settings.get('ufp:credentials') || {};
      return (nvrsettings.apiKey ? 'ok' : 'nok');
    });

    session.setHandler('list_devices', async (data) => {
      return Object.values(await homey.app.apiV2.getChimes()).map((light) => {
        return {
          data: { id: String(light.id) },
          name: light.name,
        };
      });
    });
  }

  onParseWebsocketMessage(chime, payload) {
    if (Object.prototype.hasOwnProperty.call(chime, '_events')) {
      if (payload.hasOwnProperty('volume')) {
        chime.onIsChimeOn(payload.volume);
      }
    }
  }

  getUnifiDeviceById(chime) {
    try {
      const device = this.getDevice({
        id: chime,
      });

      return device;
    } catch (Error) {
      return false;
    }
  }
}

module.exports = UniFiChimeDriver;
