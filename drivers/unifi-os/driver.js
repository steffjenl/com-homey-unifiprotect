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
        const homey = this.homey;
        session.setHandler("validate", async function (data) {
            const nvrip = homey.settings.get('ufp:nvrip');
            return (nvrip ? 'ok' : 'nok');
        });

        session.setHandler("list_devices", async function (data) {
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

    onParseWebsocketMessage(device, payload) {
        if (Object.prototype.hasOwnProperty.call(device, '_events')) {
            if (payload.hasOwnProperty('systemInfo') && payload.systemInfo.hasOwnProperty('cpu') && payload.systemInfo.cpu.hasOwnProperty('temperature')) {
                device.onTemperatureChange(payload.systemInfo.cpu.temperature);
            }

            if (payload.hasOwnProperty('systemInfo') && payload.systemInfo.hasOwnProperty('storage')) {
                device.onStorageChange(payload.systemInfo.storage);
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
};
