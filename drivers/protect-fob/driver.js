'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class ProtectFobDriver extends Homey.Driver {
  async onInit() {
    this._deviceFobButtonTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON);
    this.homey.app.debug('[ProtectFobDriver] initialized');
  }

  onPair(session) {
    const { homey } = this;

    session.setHandler('validate', async () => {
      const nvrip = homey.settings.get('ufp:nvrip');
      return (nvrip ? 'ok' : 'nok');
    });

    session.setHandler('list_devices', async () => {
      const bootstrap = homey.app.api.getBootstrap();
      if (!bootstrap || !Array.isArray(bootstrap.fobs)) {
        homey.app.debug('[ProtectFobDriver] No fobs found in bootstrap during pairing');
        return [];
      }

      return bootstrap.fobs
        .filter((fob) => fob && fob.id)
        .map((fob) => ({
          data: { id: String(fob.id) },
          name: fob.name || fob.displayName || fob.mac || `FOB ${String(fob.id).slice(-6)}`,
        }));
    });
  }

  onParseWebsocketMessage(device, payload) {
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onFobUpdate(payload);
    }
  }

  triggerFobButton(device, event) {
    this._deviceFobButtonTrigger.trigger(device, {
      ufp_fob_button: event.button,
      ufp_fob_press_type: event.pressType,
      ufp_fob_timestamp: event.timestamp,
    }).catch(this.error);
  }

  getUnifiDeviceById(deviceId) {
    try {
      const devices = this.getDevices();
      const device = devices.find((item) => String(item.getData().id) === String(deviceId));
      return device || false;
    } catch (error) {
      return false;
    }
  }
}

module.exports = ProtectFobDriver;

