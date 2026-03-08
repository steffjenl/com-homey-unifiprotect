'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class NVRAlarmDriver extends Homey.Driver {

    async onInit() {
        this.homey.app.debug('[NVRAlarmDriver] initialized');

        // Action: Set alarm state (dropdown)
        const _setAlarmState = this.homey.flow.getActionCard(UfvConstants.ACTION_NVR_SET_ALARM_STATE);
        _setAlarmState.registerRunListener(async (args) => {
            this.homey.app.debug(`[NVRAlarmDriver] set alarm state: ${args.state}`);
            const device = args.device;
            const isAway = (args.state === 'armed');
            return device.setNvrAwayMode(isAway);
        });

        // Action: Arm alarm
        const _armAlarm = this.homey.flow.getActionCard(UfvConstants.ACTION_NVR_ARM_ALARM);
        _armAlarm.registerRunListener(async (args) => {
            this.homey.app.debug('[NVRAlarmDriver] arm alarm action triggered');
            return args.device.setNvrAwayMode(true);
        });

        // Action: Disarm alarm
        const _disarmAlarm = this.homey.flow.getActionCard(UfvConstants.ACTION_NVR_DISARM_ALARM);
        _disarmAlarm.registerRunListener(async (args) => {
            this.homey.app.debug('[NVRAlarmDriver] disarm alarm action triggered');
            return args.device.setNvrAwayMode(false);
        });
    }

    onPair(session) {
        const homey = this.homey;

        session.setHandler('validate', async () => {
            const nvrip = homey.settings.get('ufp:nvrip');
            return (nvrip ? 'ok' : 'nok');
        });

        session.setHandler('list_devices', async () => {
            // The NVR Alarm Manager is a virtual device — one per NVR
            const nvrip = homey.settings.get('ufp:nvrip');
            const name = nvrip ? `NVR Alarm Manager (${nvrip})` : 'NVR Alarm Manager';
            return [
                {
                    name,
                    data: { id: 'protect-nvr-alarm' },
                },
            ];
        });
    }

    onParseWebsocketMessage(device, payload) {
        // v1 websocket NVR update — payload is the NVR object from bootstrap
        if (Object.prototype.hasOwnProperty.call(device, '_events')) {
            if (payload.hasOwnProperty('isAway')) {
                device.onAlarmStateChanged(payload.isAway);
            }
        }
    }

    getUnifiDeviceById(deviceId) {
        try {
            const devices = this.getDevices();
            const device = devices.find(d => String(d.getData().id) === String(deviceId));
            return device || false;
        } catch (e) {
            return false;
        }
    }

    getNVRAlarmDevice() {
        try {
            const devices = this.getDevices();
            return devices.length > 0 ? devices[0] : false;
        } catch (e) {
            return false;
        }
    }
}

module.exports = NVRAlarmDriver;



