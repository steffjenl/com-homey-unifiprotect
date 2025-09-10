'use strict';

const Homey = require('homey');

module.exports = class HubDriver extends Homey.Driver {

  /**
     * onInit is called when the driver is initialized.
     */
  async onInit() {
    this.log('Access HubDriver has been initialized');
  }

  onPair(session) {
    const { homey } = this;
    session.setHandler('validate', async (data) => {
      const nvrip = homey.settings.get('ufp:nvrip');
      const tokens = homey.settings.get('ufp:tokens');
      if (!nvrip || !tokens || typeof tokens.accessApiKey === 'undefined') {
        return 'nok';
      }
      return 'ok';
    });

    session.setHandler('list_devices', async (data) => {
      const hubs = await this.homey.app.accessApi.getHubs();
      return hubs.map((hub) => ({
        name: hub.name,
        data: { id: String(hub.id) },
        store: {
          location: hub.location_id,
          type: hub.type,
        },
      }));
    });
  }

  onParseWebsocketMessage(device, payload) {
    this.log('onParseWebsocketMessage', device.getName());
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      if (payload.hasOwnProperty('location_states') && Array.isArray(payload.location_states) && payload.location_states.length > 0) {
        if (payload.location_states[0].hasOwnProperty('lock')) {
          device.onLocationLockChange(payload.location_states[0].lock === 'locked');
        }
      }
    }
  }

  getUnifiDeviceById(deviceId) {
    try {
      const device = this.getDevice({
        id: deviceId,
      });

      return device;
    } catch (Error) {
      return false;
    }
  }

};
