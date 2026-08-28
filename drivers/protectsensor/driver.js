'use strict';

const Homey = require('homey');

class UniFiSensorDriver extends Homey.Driver {
    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.homey.app.debug('UniFiSensor Driver has been initialized');
    }

    onPair(session) {
        const homey = this.homey;
        session.setHandler("validate", async function (data) {
            const nvrip = homey.settings.get('ufp:nvrip') || homey.app.getV2Connection().host;
            return (nvrip ? 'ok' : 'nok:protect');
        });

        session.setHandler("list_devices", async function (data) {
            let sensors;
            if (homey.app.isV1Available()) {
                sensors = await homey.app.api.getSensors();
            } else if (homey.app.isV2Available()) {
                sensors = await homey.app.apiV2.getSensors();
            } else {
                homey.app.debug('[protectsensor] No API available for listing sensors');
                return [];
            }
            return Object.values(sensors).map(sensor => {
                return {
                    data: {id: String(sensor.id)},
                    name: sensor.name,
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


    onParseWebsocketMessage(sensor, payload) {
        if (Object.prototype.hasOwnProperty.call(sensor, '_events')) {
            if (payload.hasOwnProperty('stats') && payload.stats.hasOwnProperty('temperature')) {
                sensor.onTemperatureChange(payload.stats.temperature.value);
            }

            if (payload.hasOwnProperty('stats') && payload.stats.hasOwnProperty('humidity')) {
                sensor.onHumidityChange(payload.stats.humidity.value);
            }

            if (payload.hasOwnProperty('stats') && payload.stats.hasOwnProperty('light')) {
                sensor.onLightChange(payload.stats.light.value);
            }

            if (payload.hasOwnProperty('isOpened')) {
                sensor.onDoorChange( payload.isOpened );
            }

            if (payload.hasOwnProperty('motionDetectedAt')) {
                sensor.onMotionDetected(payload.motionDetectedAt, payload.isMotionDetected);
            }

            // UP-AirQuality: continuous readings + battery/smoke status, not documented in the
            // official v2 OpenAPI spec but confirmed present on real device bootstrap/updates.
            if (payload.hasOwnProperty('airQuality')) {
                sensor.onAirQualityChange(payload.airQuality);
            }

            if (payload.hasOwnProperty('batteryStatus')) {
                sensor.onBatteryStatusChange(payload.batteryStatus);
            }

            if (payload.hasOwnProperty('smokeStatus')) {
                sensor.onSmokeStatusChange(payload.smokeStatus);
            }

            sensor.refreshSensorData();
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

module.exports = UniFiSensorDriver;
