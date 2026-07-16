'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class NVRAlarmDriver extends Homey.Driver {

  async onInit() {
    this.homey.app.debug('[NVRAlarmDriver] initialized');

    const actionArmNvrAlarm = this.homey.flow.getActionCard(UfvConstants.ACTION_ARM_NVR_ALARM);
    actionArmNvrAlarm.registerRunListener(async (args) => {
      if (args.device && typeof args.device.setNvrAwayMode === 'function') {
        this.homey.app.debug('[NVRAlarmDriver] arm action triggered');
        await args.device.setNvrAwayMode(true);
        return Promise.resolve(true);
      }

      return Promise.reject(new Error('No NVR alarm device found'));
    });

    const actionDisarmNvrAlarm = this.homey.flow.getActionCard(UfvConstants.ACTION_DISARM_NVR_ALARM);
    actionDisarmNvrAlarm.registerRunListener(async (args) => {
      if (args.device && typeof args.device.setNvrAwayMode === 'function') {
        this.homey.app.debug('[NVRAlarmDriver] disarm action triggered');
        await args.device.setNvrAwayMode(false);
        return Promise.resolve(true);
      }

      return Promise.reject(new Error('No NVR alarm device found'));
    });
  }

  onPair(session) {
    const { homey } = this;

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
    // Websocket NVR update payload after PATCH arm or DELETE arm
    // Primary: payload.armMode = { status: 'armed'|'disarmed', armProfileId, ... }
    // Legacy:  payload.isAway = true|false
    if (typeof payload === 'object' && payload !== null) {
      if (Object.prototype.hasOwnProperty.call(payload, 'armMode')) {
        device.onAlarmStateChanged(payload.armMode);
      } else if (Object.prototype.hasOwnProperty.call(payload, 'isAway')) {
        device.onAlarmStateChanged(payload.isAway);
      }
    }
  }

  getUnifiDeviceById(deviceId) {
    try {
      const devices = this.getDevices();
      const device = devices.find((d) => String(d.getData().id) === String(deviceId));
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
