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
            if (homey.app.isV1Available()) {
                const sirens = await homey.app.api.getSirens();
                return Object.values(sirens).map(siren => {
                    return {
                        data: {id: String(siren.id)},
                        name: siren.name,
                    };
                });
            }
            // Sirens are not supported in the V2 Protect Integration API
            homey.app.debug('[protect-siren] Sirens not supported in V2 API, requires V1 (username/password)');
            return [];
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
