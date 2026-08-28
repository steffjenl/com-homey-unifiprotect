'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class ProtectFobDriver extends Homey.Driver {
  async onInit() {
    this._deviceFobButtonTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON);
    this._deviceFobButtonPressTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_PRESS);
    this._deviceFobButtonLongPressTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_LONG_PRESS);
    this._deviceFobButtonDoublePressTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_DOUBLE_PRESS);
    this._deviceFobButtonArmTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_ARM);
    this._deviceFobButtonDisarmTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_DISARM);
    this._deviceFobButtonPanicTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_PANIC);
    this._deviceFobButtonNightTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_NIGHT);
    this._deviceFobButtonLeftTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_LEFT);
    this._deviceFobButtonRightTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_RIGHT);
    this.homey.app.debug('[ProtectFobDriver] initialized');
  }

  onPair(session) {
    const { homey } = this;

    session.setHandler('validate', async () => {
      const nvrip = homey.settings.get('ufp:nvrip') || homey.app.getV2Connection().host;
      return (nvrip ? 'ok' : 'nok:protect');
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
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onFobUpdate(payload);
    }
  }

  triggerFobButton(device, event) {
    const tokens = {
      ufp_fob_button: event.button,
      ufp_fob_press_type: event.pressType,
      ufp_fob_timestamp: event.timestamp,
    };

    this._deviceFobButtonTrigger.trigger(device, tokens).catch(this.error);

    // Per press type
    if (event.pressType === 'press') {
      this._deviceFobButtonPressTrigger.trigger(device, tokens).catch(this.error);
    } else if (event.pressType === 'longPress') {
      this._deviceFobButtonLongPressTrigger.trigger(device, tokens).catch(this.error);
    } else if (event.pressType === 'doublePress') {
      this._deviceFobButtonDoublePressTrigger.trigger(device, tokens).catch(this.error);
    }

    // Per button
    const buttonTriggerMap = {
      arm: this._deviceFobButtonArmTrigger,
      disarm: this._deviceFobButtonDisarmTrigger,
      panic: this._deviceFobButtonPanicTrigger,
      night: this._deviceFobButtonNightTrigger,
      left: this._deviceFobButtonLeftTrigger,
      right: this._deviceFobButtonRightTrigger,
    };
    const buttonTrigger = buttonTriggerMap[event.button];
    if (buttonTrigger) {
      buttonTrigger.trigger(device, tokens).catch(this.error);
    }
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
