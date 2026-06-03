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
            const nvrip = homey.settings.get('ufp:nvrip');
            return (nvrip ? 'ok' : 'nok');
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
