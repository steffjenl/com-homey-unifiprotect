'use strict';

const Homey = require('homey');

module.exports = class MyDriver extends Homey.Driver {

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this._garageDoorOpened = this.homey.flow.getDeviceTriggerCard('ufv_reader_garagedoor_opened');
        this._garageDoorClosed = this.homey.flow.getDeviceTriggerCard('ufv_reader_garagedoor_closed');
        this.log('Access Garagedoor Driver has been initialized');
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

    onAccessLogKeypaddEvent(device, { credentialProvider, actor, result }) {
        this.log(`[AccessGarageDoorDriver] onAccessLogKeypaddEvent device=${device.getName()} credential=${credentialProvider} actor=${actor} result=${result}`);
        // Backwards-compatible: fires for every keypad attempt
        this.homey.app._deviceAccessGarageDoorKeypaddUsedTrigger.trigger(device, {
            ufv_actor: actor,
            ufv_auth_method: credentialProvider,
        }).catch(this.error);
        // Specific granted / denied triggers
        if (result === 'ACCESS') {
            this.homey.app._deviceAccessGarageDoorKeypaddGrantedTrigger.trigger(device, {
                ufv_actor: actor,
            }).catch(this.error);
        } else if (result === 'BLOCKED') {
            this.homey.app._deviceAccessGarageDoorKeypaddDeniedTrigger.trigger(device, { }).catch(this.error);
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

    triggerGarageDoorOpened(device, tokens, state) {
        this._garageDoorOpened
            .trigger(device, tokens, state)
            .catch(this.error);
    }

    triggerGarageDoorClosed(device, tokens, state) {
        this._garageDoorClosed
            .trigger(device, tokens, state)
            .catch(this.error);
    }

};
