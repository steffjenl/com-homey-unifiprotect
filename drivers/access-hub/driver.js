'use strict';

const Homey = require('homey');

module.exports = class HubDriver extends Homey.Driver {

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.log('Access HubDriver has been initialized');
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
            const hubs = await this.homey.app.accessApi.getHubs();
            return hubs.map((hub) => ({
                name: hub.name,
                data: {id: String(hub.id)},
                store: {
                    location: hub.location_id,
                    type: hub.type,
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
            if (payload.hasOwnProperty('location_states') && Array.isArray(payload.location_states) && payload.location_states.length > 0) {
                if (payload.location_states[0].hasOwnProperty('lock')) {
                    device.onLocationLockChange(payload.location_states[0].lock === 'locked');
                }
            }
        }
    }

    getUnifiDeviceById(deviceId) {
        try {
            const driver = this.driver;
            const devices = driver.getDevices();
            const device = devices.find(device => String(device.getData().id) === String(deviceId));
            if (!device) return false;
            return device;
        } catch (Error) {
            return false;
        }
    }

};
