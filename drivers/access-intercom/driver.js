'use strict';

const Homey = require('homey');

class AccessIntercomeDriver extends Homey.Driver {
  async onInit() {
    this.log('Access Intercom Driver has been initialized');

    this._intercomeeBellPressedTrigger = this.homey.flow.getDeviceTriggerCard('ufv_device_intercom_bell_pressed');

    const _intercomeUnlockDoor = this.homey.flow.getActionCard('ufv_intercom_unlock_door');
    _intercomeUnlockDoor.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.accessApi.setDoorUnLock(args.device.getData().doorId || args.device.getData().id);
      }
      return Promise.resolve(true);
    });
  }

  onPair(session) {
    const { homey } = this;

    session.setHandler('validate', async () => {
      const nvrip = homey.settings.get('ufp:nvrip');
      const tokens = homey.settings.get('ufp:tokens');
      if (!nvrip || !tokens || typeof tokens.accessApiKey === 'undefined') {
        return 'nok';
      }
      return 'ok';
    });

    session.setHandler('list_devices', async () => {
      const intercoms = await homey.app.accessApi.getIntercoms();
      return intercoms.map((device) => ({
        name: device.alias || device.display_model || 'Intercom',
        data: {
          id: String(device.unique_id || device.id),
          mac: device.mac,
          doorId: device.location_id || null,
        },
      }));
    });
  }

  onParseWebsocketMessage(device, payload) {
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      if (payload.state) {
        if (payload.state.lock) {
          device.onLockChange(payload.state.lock === 'locked');
        }
        if (payload.state.dps) {
          device.onDoorChange(payload.state.dps === 'open');
        }
      }
    }
  }

  triggerBellPressed(device) {
    this._intercomeeBellPressedTrigger.trigger(device, {}).catch(this.error);
  }

  getUnifiDeviceById(deviceId) {
    try {
      const devices = this.getDevices();
      const device = devices.find((d) => String(d.getData().id) === String(deviceId));
      if (!device) return false;
      return device;
    } catch (error) {
      return false;
    }
  }

  getUnifiDeviceByMac(mac) {
    try {
      const devices = this.getDevices();
      const device = devices.find((d) => String(d.getData().mac || '').toLowerCase() === String(mac).toLowerCase());
      if (!device) return false;
      return device;
    } catch (error) {
      return false;
    }
  }
}

module.exports = AccessIntercomeDriver;
