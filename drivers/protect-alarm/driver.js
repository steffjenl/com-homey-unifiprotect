'use strict';

const Homey = require('homey');

class ProtectAlarmDriver extends Homey.Driver {
    async onInit() {
        this._registerFlowCards();
        this.homey.app.debug('UniFi Protect Alarm Manager Driver has been initialized');
    }

    _registerFlowCards() {
        this._alarmTriggeredTrigger = this.homey.flow.getDeviceTriggerCard('alarm_triggered');
        this._registerActionCards();
    }

    _registerActionCards() {
        const armAlarmAction = this.homey.flow.getActionCard('arm_alarm');
        armAlarmAction.registerRunListener(async (args, state) => {
            await args.device.setCapabilityValue('homealarm_state', 'armed');
        });

        const disarmAlarmAction = this.homey.flow.getActionCard('disarm_alarm');
        disarmAlarmAction.registerRunListener(async (args, state) => {
            await args.device.setCapabilityValue('homealarm_state', 'disarmed');
        });
    }

    async triggerAlarmTriggered(device, tokens) {
        return this._alarmTriggeredTrigger.trigger(device, tokens);
    }

    onPair(session) {
        const homey = this.homey;

        session.setHandler("validate", async function (data) {
            const nvrip = homey.settings.get('ufp:nvrip');
            return (nvrip ? 'ok' : 'nok');
        });

        session.setHandler("list_devices", async function (data) {
            try {
                const nvrs = await homey.app.apiV2.getNVR();

                if (!nvrs || nvrs.length === 0) {
                    return [];
                }

                const nvr = nvrs[0];
                return [{
                    data: {
                        id: String(nvr.id),
                        type: 'alarm-manager'
                    },
                    name: `${nvr.name || 'UniFi Protect'} Alarm`,
                }];
            } catch (error) {
                homey.app.error('Error listing alarm devices:', error);
                return [];
            }
        });
    }

    onParseWebsocketMessage(alarm, payload) {
        if (!alarm || !Object.prototype.hasOwnProperty.call(alarm, '_events')) {
            return;
        }

        if (payload.hasOwnProperty('isAlarmsEnabled')) {
            alarm.onAlarmStateChange(payload.isAlarmsEnabled);
        }

        if (payload.hasOwnProperty('lastAlarmAt')) {
            alarm.onAlarmTriggered(payload.lastAlarmAt);
        }
    }

    getUnifiDeviceById(deviceId) {
        try {
            const devices = this.getDevices();
            const device = devices.find(device =>
                String(device.getData().id) === String(deviceId)
            );

            if (!device) return false;
            return device;
        } catch (error) {
            this.homey.app.error('Error finding alarm device:', error);
            return false;
        }
    }
}

module.exports = ProtectAlarmDriver;

