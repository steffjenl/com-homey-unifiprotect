'use strict';

const Homey = require('homey');

module.exports = class UniFiOSDriver extends Homey.Driver {

  /**
     * onInit is called when the driver is initialized.
     */
  async onInit() {
    this.log('UniFiOSDriver has been initialized');
  }

  onPair(session) {
    const { homey } = this;
    session.setHandler('validate', async (data) => {
      const nvrip = homey.settings.get('ufp:nvrip') || homey.app.getV2Connection().host;
      return (nvrip ? 'ok' : 'nok:protect');
    });

    session.setHandler('list_devices', async (data) => {
      return [
        {
          name: 'UniFi OS Controller',
          data: {
            id: 'unifi-os-controller',
          },
        },
      ];
    });
  }

  async onRepair(session, device) {
    const { homey } = this;

    session.setHandler('get_repair_data', async () => {
      const v2Conn = homey.app.getV2Connection();
      const nvrip = homey.settings.get('ufp:nvrip');
      const tokens = homey.settings.get('ufp:tokens') || {};
      const isV2 = !!(tokens.protectV2ApiKey);
      const host = v2Conn.host || nvrip || '';
      const port = v2Conn.port || 443;
      const connected = homey.app.isControllerReachable(isV2 ? 'v2' : 'v1');
      let status = 'Disconnected';
      if (isV2) {
        if (homey.app.apiV2 && homey.app.apiV2.websocket) status = homey.app.apiV2.websocket.loggedInStatus;
      } else if (homey.app.api) {
        status = homey.app.api.loggedInStatus;
      }

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
        const { host } = data;
        const port = data.port || '443';
        const { token } = data;

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
        homey.app.debug(`[onRepair] save_repair_data error: ${error}`);
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
      const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
      if (has(payload, 'systemInfo') && has(payload.systemInfo, 'cpu') && has(payload.systemInfo.cpu, 'temperature')) {
        device.onTemperatureChange(payload.systemInfo.cpu.temperature);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'systemInfo') && Object.prototype.hasOwnProperty.call(payload.systemInfo, 'storage')) {
        device.onStorageChange(payload.systemInfo.storage);
      }
    }
  }

  getUnifiDeviceById(deviceId) {
    try {
      const devices = this.getDevices();
      const device = devices.find((device) => String(device.getData().id) === String(deviceId));
      if (!device) return false;
      return device;
    } catch (Error) {
      return false;
    }
  }
};
