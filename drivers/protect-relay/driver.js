'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class UniFiRelayDriver extends Homey.Driver {
  async onInit() {
    this._relayStateChangedTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_RELAY_STATE_CHANGED);
    this._relayTurnedOnTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_RELAY_TURNED_ON);
    this._relayTurnedOffTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_RELAY_TURNED_OFF);
    this.homey.app.debug('UniFiRelay Driver has been initialized');
  }

  onPair(session) {
    const homey = this.homey;
    let pairMode = 'auto';

    session.setHandler('validate', async function () {
      const nvrip = homey.settings.get('ufp:nvrip') || homey.app.getV2Connection().host;
      return (nvrip ? 'ok' : 'nok:protect');
    });

    session.setHandler('set_pair_mode', async function (mode) {
      if (mode === 'force_garagedoor' || mode === 'force_relay' || mode === 'auto') {
        pairMode = mode;
      } else {
        pairMode = 'auto';
      }

      return pairMode;
    });

    session.setHandler('get_pair_mode', async function () {
      return pairMode;
    });

    session.setHandler('list_devices', async function () {
      let relays;

      if (homey.app.isV1Available()) {
        relays = await homey.app.api.getRelays();
      } else if (homey.app.isV2Available()) {
        relays = await homey.app.apiV2.getRelays();
      } else {
        homey.app.debug('[protect-relay] No API available for listing relays');
        return [];
      }

      return Object.values(relays).flatMap((relay) => {
        const relayName = relay.name || relay.displayName || 'Relay';
        const outputs = UniFiRelayDriver.getOutputs(relay);

        return outputs.map((output) => {
          const outputName = output.name || `Output ${Number(output.id) + 1}`;
          const outputType = output.type || 'relay';
          const classOverride = pairMode === 'force_garagedoor'
            ? 'garagedoor'
            : (pairMode === 'force_relay' ? 'relay' : null);

          return {
            data: {
              id: `${String(relay.id)}:${String(output.id)}`,
              relayId: String(relay.id),
              outputId: Number(output.id),
              outputType,
              classOverride,
            },
            name: `${relayName} (${outputName})`,
          };
        });
      });
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


  static getOutputs(relay) {
    if (!relay || !Array.isArray(relay.outputs) || relay.outputs.length === 0) {
      return [{ id: 0, name: null, type: null, state: 'off' }];
    }

    return relay.outputs;
  }

  onParseWebsocketMessage(device, payload) {
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      if (
        Object.prototype.hasOwnProperty.call(payload, 'outputs')
        || Object.prototype.hasOwnProperty.call(payload, 'inputs')
      ) {
        device.onRelayUpdate(payload);
      }
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

  getUnifiDevicesByRelayId(relayId) {
    try {
      const devices = this.getDevices();
      return devices.filter((device) => String(device.getRelayId()) === String(relayId));
    } catch (error) {
      return [];
    }
  }

  triggerRelayStateChanged(device, stateToken) {
    this._relayStateChangedTrigger.trigger(device, {
      relay_state: stateToken,
      relay_state_onoff: stateToken === 'on',
    }).catch(this.error);
  }

  triggerRelayTurnedOn(device) {
    this._relayTurnedOnTrigger.trigger(device, {}).catch(this.error);
  }

  triggerRelayTurnedOff(device) {
    this._relayTurnedOffTrigger.trigger(device, {}).catch(this.error);
  }
}

module.exports = UniFiRelayDriver;

