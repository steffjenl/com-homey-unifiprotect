'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class UniFiChimeDriver extends Homey.Driver {
    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this._deviceActionPlayTestTone = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_TEST_CHIME_TONE);
        this._deviceActionPlayTestTone.registerRunListener(async (args) => {
            return this.homey.app.api.playChimeTone(args.device.getData()).catch(this.error);
        });
        this.homey.app.debug('UniFiChime Driver has been initialized');
    }

    onPair(session) {
        const homey = this.homey;
        session.setHandler("validate", async function (data) {
            const nvrip = homey.settings.get('ufp:nvrip');
            return (nvrip ? 'ok' : 'nok');
        });

        session.setHandler("list_devices", async function (data) {
            return Object.values(await homey.app.api.getChimes()).map(light => {
                return {
                    data: {id: String(light.id)},
                    name: light.name,
                };
            });
        });
    }

    onParseWebsocketMessage(chime, payload) {
        if (Object.prototype.hasOwnProperty.call(chime, '_events')) {
            if (payload.hasOwnProperty('volume')) {
                chime.onIsChimeOn(payload.volume);
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

module.exports = UniFiChimeDriver;
