'use strict';

const Homey = require('homey');

module.exports = class MyDriver extends Homey.Driver {

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.log('Access Door Driver has been initialized');
    }

    onPair(session) {
        const {homey} = this;
        session.setHandler('validate', async (data) => {
            const nvrip = homey.settings.get('ufp:nvrip');
            const tokens = homey.settings.get('ufp:tokens');
            if (!nvrip || !tokens || typeof tokens.accessApiKey === 'undefined') {
                return 'nok';
            }
            return 'ok';
        });

        session.setHandler('list_devices', async (data) => {
            const doors = await this.homey.app.accessApi.getDoors();
            return doors.map((door) => ({
                name: door.full_name,
                data: {id: String(door.id)},
                store: {
                    floor_id: door.floor_id,
                    type: door.type,
                },
            }));
        });
    }

    onParseWebsocketMessage(device, payload) {
        this.log('onParseWebsocketMessage', device.getName());
        if (Object.prototype.hasOwnProperty.call(device, '_events')) {
            if (payload.hasOwnProperty('state')) {
                if (payload.state.hasOwnProperty('lock')) {
                    device.onLockChange(payload.state.lock === 'locked');
                }
                if (payload.state.hasOwnProperty('dps')) {
                    device.onDoorChange(payload.state.dps === 'open');
                }
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
