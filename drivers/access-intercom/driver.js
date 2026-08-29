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
      const { host } = homey.app.getAccessConnection();
      const tokens = homey.settings.get('ufp:tokens');
      if (!host || !tokens || typeof tokens.accessApiKey === 'undefined') {
        return 'nok:access';
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

        async onRepair(session, device) {
        const homey = this.homey;

        session.setHandler('get_repair_data', async () => {
            const accessConn = homey.app.getAccessConnection();
            const tokens = homey.settings.get('ufp:tokens') || {};
            const host = accessConn.host || '';
            const port = accessConn.port || 12445;
            const connected = homey.app.isControllerReachable('access');
            const status = (homey.app.accessApi && homey.app.accessApi.websocket)
                ? homey.app.accessApi.websocket.loggedInStatus 
                : 'Disconnected';

            return {
                deviceName: device ? device.getName() : 'UniFi Access',
                apiType: 'access',
                host,
                port,
                apiKey: tokens.accessApiKey || '',
                connected,
                status,
            };
        });

        session.setHandler('save_repair_data', async (data) => {
            try {
                const host = data.host;
                const port = data.port || '12445';
                const token = data.token;

                const tokens = homey.settings.get('ufp:tokens') || {};
                if (token) {
                    tokens.accessApiKey = token;
                    homey.settings.set('ufp:tokens', tokens);
                }

                homey.settings.set('ufp:accessnvr', { nvrip: host, nvrport: port });

                if (tokens.accessApiKey) {
                    await homey.app._initAccessStack();
                    await homey.app.appAccess.loginToAccess();
                }

                if (device) {
                    await device.setAvailable().catch(homey.error);
                }

                return { status: 'ok', message: 'Connection restored' };
            } catch (error) {
                homey.app.debug('[onRepair] save_repair_data error: ' + error);
                return { status: 'failure', error: error.message || String(error) };
            }
        });

        session.setHandler('validate', async () => {
            return 'ok';
        });
    }

    async repair(session, device) {
        return this.onRepair(session, device);
    }


  onParseWebsocketMessage(device, payload) {
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      if (payload.state) {
        if (payload.state.lock) {
          device.onLockChange(payload.state.lock === 'locked');
        }
        if (payload.state.dps) {
          device.onDoorChange(payload.state.dps, payload.state.dps_connected);
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
