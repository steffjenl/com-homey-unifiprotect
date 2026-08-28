'use strict';

const Homey = require('homey');

class UniFiLightDriver extends Homey.Driver {
    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.homey.app.debug('UniFiLight Driver has been initialized');
    }

    onPair(session) {
        const homey = this.homey;
        session.setHandler("validate", async function (data) {
            const nvrip = homey.settings.get('ufp:nvrip') || homey.app.getV2Connection().host;
            return (nvrip ? 'ok' : 'nok:protect');
        });

        session.setHandler("list_devices", async function (data) {
            let lights;
            if (homey.app.isV1Available()) {
                lights = await homey.app.api.getLights();
            } else if (homey.app.isV2Available()) {
                lights = await homey.app.apiV2.getLights();
            } else {
                homey.app.debug('[protectlight] No API available for listing lights');
                return [];
            }
            return Object.values(lights).map(light => {
                return {
                    data: {id: String(light.id)},
                    name: light.name,
                };
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


    onParseWebsocketMessage(light, payload) {
        if (Object.prototype.hasOwnProperty.call(light, '_events')) {
            if (payload.hasOwnProperty('isLightOn')) {
                light.onIsLightOn(payload.isLightOn);
            }

            if (payload.hasOwnProperty('isPirMotionDetected')) {
                light.onMotionDetected(payload.lastMotion, payload.isPirMotionDetected);
            }

            if (payload.hasOwnProperty('lightDeviceSettings') && payload.lightDeviceSettings.hasOwnProperty('ledLevel')) {
                light.onLedLevelChange(payload.lightDeviceSettings.ledLevel);
            }

            if (payload.hasOwnProperty('lightModeSettings') && payload.lightModeSettings.hasOwnProperty('mode')) {
                light.onLightModeChange(payload.lightModeSettings);
            }
        }
    }

    getUnifiDeviceById(deviceId) {
        try {
            const devices = this.getDevices();
            const device = devices.find(device => String(device.getData().id) === String(deviceId));
            if (!device) return false;
            return device;
        } catch (Error) {
            return false;
        }
    }
}

module.exports = UniFiLightDriver;
