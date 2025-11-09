'use strict';

const Homey = require('homey');

class UniFiSirenDriver extends Homey.Driver {
    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.homey.app.debug('UniFiSiren Driver has been initialized');
    }

    onPair(session) {
        const homey = this.homey;
        session.setHandler("validate", async function (data) {
            const nvrip = homey.settings.get('ufp:nvrip');
            return (nvrip ? 'ok' : 'nok');
        });

        session.setHandler("list_devices", async function (data) {
            return Object.values(await homey.app.api.getSirens()).map(siren => {
                return {
                    data: {id: String(siren.id)},
                    name: siren.name,
                };
            });
        });
    }

    onParseWebsocketMessage(siren, payload) {
        if (Object.prototype.hasOwnProperty.call(siren, '_events')) {
            if (payload.hasOwnProperty('volume')) {
                siren.onIsSirenOn(payload.volume);
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

module.exports = UniFiSirenDriver;
