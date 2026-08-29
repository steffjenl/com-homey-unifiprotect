'use strict';

const Homey = require('homey');

module.exports = class MyDriver extends Homey.Driver {

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this._doorOpened = this.homey.flow.getDeviceTriggerCard('ufv_reader_door_opened');
        this._doorClosed = this.homey.flow.getDeviceTriggerCard('ufv_reader_door_closed');
        this.log('Access Door Driver has been initialized');
    }

    onPair(session) {
        const {homey} = this;
        session.setHandler('validate', async (data) => {
            const {host} = homey.app.getAccessConnection();
            const tokens = homey.settings.get('ufp:tokens');
            if (!host || !tokens || typeof tokens.accessApiKey === 'undefined') {
                return 'nok:access';
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

        async onRepair(session, device) {
        const homey = this.homey;

        session.setHandler('get_repair_data', async () => {
            const accessConn = homey.app.getAccessConnection();
            const tokens = homey.settings.get('ufp:tokens') || {};
            const host = accessConn.host || '';
            const port = accessConn.port || 12445;
            const connected = homey.app.isControllerReachable('access');
            const status = (homey.app.accessApi && homey.app.accessApi.websocket)
                ? homey.app.accessApi.websocket.loggedInStatus 
                : 'Disconnected';

            return {
                deviceName: device ? device.getName() : 'UniFi Access',
                apiType: 'access',
                host,
                port,
                apiKey: tokens.accessApiKey || '',
                connected,
                status,
            };
        });

        session.setHandler('save_repair_data', async (data) => {
            try {
                const host = data.host;
                const port = data.port || '12445';
                const token = data.token;

                const tokens = homey.settings.get('ufp:tokens') || {};
                if (token) {
                    tokens.accessApiKey = token;
                    homey.settings.set('ufp:tokens', tokens);
                }

                homey.settings.set('ufp:accessnvr', { nvrip: host, nvrport: port });

                if (tokens.accessApiKey) {
                    await homey.app._initAccessStack();
                    await homey.app.appAccess.loginToAccess();
                }

                if (device) {
                    await device.setAvailable().catch(homey.error);
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


    onParseWebsocketMessage(device, payload) {
        this.log('onParseWebsocketMessage', device.getName());
        if (Object.prototype.hasOwnProperty.call(device, '_events')) {
            if (payload.hasOwnProperty('state')) {
                if (payload.state.hasOwnProperty('lock')) {
                    device.onLockChange(payload.state.lock === 'locked');
                }
                if (payload.state.hasOwnProperty('dps')) {
                    device.onDoorChange(payload.state.dps, payload.state.dps_connected);
                }
            }
        }
    }

    triggerDoorOpened(device, tokens, state) {
        this._doorOpened
            .trigger(device, tokens, state)
            .catch(this.error);
    }

    triggerDoorClosed(device, tokens, state) {
        this._doorClosed
            .trigger(device, tokens, state)
            .catch(this.error);
    }

    onAccessLogKeypaddEvent(device, { credentialProvider, actor, result }) {
        this.log(`[AccessDoorDriver] onAccessLogKeypaddEvent device=${device.getName()} credential=${credentialProvider} actor=${actor} result=${result}`);
        // Backwards-compatible: fires for every keypad attempt
        this.homey.app._deviceAccessKeypaddUsedTrigger.trigger(device, {
            ufv_actor: actor,
            ufv_auth_method: credentialProvider,
        }).catch(this.error);
        // Specific granted / denied triggers
        if (result === 'ACCESS') {
            this.homey.app._deviceAccessKeypaddGrantedTrigger.trigger(device, {
                ufv_actor: actor,
            }).catch(this.error);
        } else if (result === 'BLOCKED') {
            this.homey.app._deviceAccessKeypaddDeniedTrigger.trigger(device, { }).catch(this.error);
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
