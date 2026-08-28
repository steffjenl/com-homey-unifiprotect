'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class NVRAlarmDriver extends Homey.Driver {

  async onInit() {
    this.homey.app.debug('[NVRAlarmDriver] initialized');

    const actionArmNvrAlarm = this.homey.flow.getActionCard(UfvConstants.ACTION_ARM_NVR_ALARM);
    actionArmNvrAlarm.registerRunListener(async (args) => {
      if (args.device && typeof args.device.setNvrAwayMode === 'function') {
        this.homey.app.debug('[NVRAlarmDriver] arm action triggered');
        await args.device.setNvrAwayMode(true);
        return Promise.resolve(true);
      }

      return Promise.reject(new Error('No NVR alarm device found'));
    });

    const actionDisarmNvrAlarm = this.homey.flow.getActionCard(UfvConstants.ACTION_DISARM_NVR_ALARM);
    actionDisarmNvrAlarm.registerRunListener(async (args) => {
      if (args.device && typeof args.device.setNvrAwayMode === 'function') {
        this.homey.app.debug('[NVRAlarmDriver] disarm action triggered');
        await args.device.setNvrAwayMode(false);
        return Promise.resolve(true);
      }

      return Promise.reject(new Error('No NVR alarm device found'));
    });
  }

  onPair(session) {
    const { homey } = this;

    session.setHandler('validate', async () => {
      const nvrip = homey.settings.get('ufp:nvrip');
      return (nvrip ? 'ok' : 'nok');
    });

    session.setHandler('list_devices', async () => {
      // The NVR Alarm Manager is a virtual device — one per NVR
      const nvrip = homey.settings.get('ufp:nvrip');
      const name = nvrip ? `NVR Alarm Manager (${nvrip})` : 'NVR Alarm Manager';
      return [
        {
          name,
          data: { id: 'protect-nvr-alarm' },
        },
      ];
    });
  }

        async onRepair(session, device) {
        const homey = this.homey;

        session.setHandler('get_repair_data', async () => {
            const v2Conn = homey.app.getV2Connection();
            const nvrip = homey.settings.get('ufp:nvrip');
            const tokens = homey.settings.get('ufp:tokens') || {};
            const isV2 = !!(tokens.protectV2ApiKey);
            const host = v2Conn.host || nvrip || '';
            const port = v2Conn.port || 443;
            const connected = homey.app.isControllerReachable(isV2 ? 'v2' : 'v1');
            const status = isV2 
                ? (homey.app.apiV2 && homey.app.apiV2.websocket ? homey.app.apiV2.websocket.loggedInStatus : 'Disconnected')
                : (homey.app.api ? homey.app.api.loggedInStatus : 'Disconnected');

            return {
                deviceName: device ? device.getName() : 'UniFi Protect',
                apiType: 'protect',
                host,
                port,
                isV2,
                apiKey: tokens.protectV2ApiKey || '',
                connected,
                status,
            };
        });

        session.setHandler('save_repair_data', async (data) => {
            try {
                const host = data.host;
                const port = data.port || '443';
                const token = data.token;

                const tokens = homey.settings.get('ufp:tokens') || {};
                if (token) {
                    tokens.protectV2ApiKey = token;
                    homey.settings.set('ufp:tokens', tokens);
                }

                homey.settings.set('ufp:v2nvr', { nvrip: host, nvrport: port });
                homey.settings.set('ufp:nvrip', host);
                homey.settings.set('ufp:nvrport', port);

                if (tokens.protectV2ApiKey) {
                    homey.app._initProtectV2Stack();
                    await homey.app.appProtect.loginToProtectV2();
                } else {
                    homey.app.appProtect._appLogin();
                }

                if (device) {
                    await device.setAvailable().catch(homey.error);
                    if (typeof device.initDevice === 'function') {
                        await device.initDevice().catch(homey.error);
                    }
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
    // Websocket NVR update payload after PATCH arm or DELETE arm
    // Primary: payload.armMode = { status: 'armed'|'disarmed', armProfileId, ... }
    // Legacy:  payload.isAway = true|false
    if (typeof payload === 'object' && payload !== null) {
      if (Object.prototype.hasOwnProperty.call(payload, 'armMode')) {
        device.onAlarmStateChanged(payload.armMode);
      } else if (Object.prototype.hasOwnProperty.call(payload, 'isAway')) {
        device.onAlarmStateChanged(payload.isAway);
      }
    }
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

  getNVRAlarmDevice() {
    try {
      const devices = this.getDevices();
      return devices.length > 0 ? devices[0] : false;
    } catch (e) {
      return false;
    }
  }

}

module.exports = NVRAlarmDriver;
