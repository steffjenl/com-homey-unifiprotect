'use strict';

const Homey = require('homey');

module.exports = class ReaderDriver extends Homey.Driver {

    /**
     * onInit is called when the driver is initialized.
     */
    async onInit() {
        this.log('ReaderDriver has been initialized');
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
            const readers = await this.homey.app.accessApi.getReaders();
            return readers.map((reader) => ({
                name: reader.name,
                data: {id: String(reader.id)},
                store: {
                    location: reader.location_id,
                    type: reader.type,
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
            if (payload.hasOwnProperty('access_method')) {
                if (payload.access_method.hasOwnProperty('nfc')) {
                    device.onNfcConfigChange(payload.access_method.nfc === 'yes');
                }
                if (payload.access_method.hasOwnProperty('wave')) {
                    device.onWaveConfigChange(payload.access_method.wave === 'yes');
                }
                if (payload.access_method.hasOwnProperty('bt_button')) {
                    device.onMobileButtonConfigChange(payload.access_method.bt_button === 'yes');
                }
                if (payload.access_method.hasOwnProperty('bt_tap')) {
                    device.onMobileTapConfigChange(payload.access_method.bt_tap === 'yes');
                }
                if (payload.access_method.hasOwnProperty('touch_pass')) {
                    device.onTouchPassConfigChange(payload.access_method.touch_pass === 'yes');
                }
                if (payload.access_method.hasOwnProperty('apple_pass')) {
                    device.onTouchPassConfigChange(payload.access_method.touch_pass === 'yes');
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
