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
            return Object.values(await homey.app.api.getSensors()).map(sensor => {
                return {
                    data: {id: String(sensor.id)},
                    name: sensor.name,
                };
            });
        });
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

            sensor.refreshSensorData();
        }
    }

    getUnifiDeviceById(camera) {
        try {
            const device = this.getDevice({
                id: camera,
            });

            return device;
        } catch (Error) {
            return false;
        }
    }
}

module.exports = UniFiLightDriver;
