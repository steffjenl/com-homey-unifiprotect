'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class ProtectFobDriver extends Homey.Driver {
  async onInit() {
    this._deviceFobButtonTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON);
    this._deviceFobButtonPressTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_PRESS);
    this._deviceFobButtonLongPressTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_LONG_PRESS);
    this._deviceFobButtonDoublePressTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_DOUBLE_PRESS);
    this._deviceFobButtonArmTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_ARM);
    this._deviceFobButtonDisarmTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_DISARM);
    this._deviceFobButtonPanicTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_PANIC);
    this._deviceFobButtonNightTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_NIGHT);
    this._deviceFobButtonLeftTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_LEFT);
    this._deviceFobButtonRightTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_FOB_BUTTON_RIGHT);
    this.homey.app.debug('[ProtectFobDriver] initialized');
  }

  onPair(session) {
    const { homey } = this;

    session.setHandler('validate', async () => {
      const nvrip = homey.settings.get('ufp:nvrip');
      return (nvrip ? 'ok' : 'nok');
    });

    session.setHandler('list_devices', async () => {
      const bootstrap = homey.app.api.getBootstrap();
      if (!bootstrap || !Array.isArray(bootstrap.fobs)) {
        homey.app.debug('[ProtectFobDriver] No fobs found in bootstrap during pairing');
        return [];
      }

      return bootstrap.fobs
        .filter((fob) => fob && fob.id)
        .map((fob) => ({
          data: { id: String(fob.id) },
          name: fob.name || fob.displayName || fob.mac || `FOB ${String(fob.id).slice(-6)}`,
        }));
    });
  }

  onParseWebsocketMessage(device, payload) {
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onFobUpdate(payload);
    }
  }

  triggerFobButton(device, event) {
    const tokens = {
      ufp_fob_button: event.button,
      ufp_fob_press_type: event.pressType,
      ufp_fob_timestamp: event.timestamp,
    };

    this._deviceFobButtonTrigger.trigger(device, tokens).catch(this.error);

    // Per press type
    if (event.pressType === 'press') {
      this._deviceFobButtonPressTrigger.trigger(device, tokens).catch(this.error);
    } else if (event.pressType === 'longPress') {
      this._deviceFobButtonLongPressTrigger.trigger(device, tokens).catch(this.error);
    } else if (event.pressType === 'doublePress') {
      this._deviceFobButtonDoublePressTrigger.trigger(device, tokens).catch(this.error);
    }

    // Per button
    const buttonTriggerMap = {
      arm: this._deviceFobButtonArmTrigger,
      disarm: this._deviceFobButtonDisarmTrigger,
      panic: this._deviceFobButtonPanicTrigger,
      night: this._deviceFobButtonNightTrigger,
      left: this._deviceFobButtonLeftTrigger,
      right: this._deviceFobButtonRightTrigger,
    };
    const buttonTrigger = buttonTriggerMap[event.button];
    if (buttonTrigger) {
      buttonTrigger.trigger(device, tokens).catch(this.error);
    }
  }

  getUnifiDeviceById(deviceId) {
    try {
      const devices = this.getDevices();
      const device = devices.find((item) => String(item.getData().id) === String(deviceId));
      return device || false;
    } catch (error) {
      return false;
    }
  }
}

module.exports = ProtectFobDriver;
