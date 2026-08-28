'use strict';

const Homey = require('homey');
const ConnectionMonitorMixin = require('../../library/ConnectionMonitorMixin');

class ProtectFobDevice extends Homey.Device {
  async onInit() {
    this._startConnectionMonitoring('v2');
    await this.waitForBootstrap();
    this.homey.app.debug('[ProtectFobDevice] initialized');
  }

  async onAdded() {
    this.homey.app.debug('[ProtectFobDevice] added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.homey.app.debug('[ProtectFobDevice] settings changed');
  }

  async onRenamed(name) {
    this.homey.app.debug('[ProtectFobDevice] renamed');
  }

  async onDeleted() {
    this.homey.app.debug('[ProtectFobDevice] deleted');
  }

  async waitForBootstrap() {
    const v1Ready = typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null;
    const v2Ready = this.homey.app.isV2Available();

    if (v1Ready || v2Ready) {
      await this.initDevice();
    } else {
      this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async initDevice() {
    await this._createMissingCapabilities();
    await this._initDeviceData();
  }

  async _createMissingCapabilities() {
    if (!this.hasCapability('measure_battery')) {
      await this.addCapability('measure_battery');
    }

    if (this.hasCapability('alarm_battery')) {
      await this.removeCapability('alarm_battery');
    }
  }

  async _initDeviceData() {
    try {
      const bootstrap = this.homey.app.api.getBootstrap();
      if (!bootstrap || !Array.isArray(bootstrap.fobs)) {
        return;
      }

      const fob = bootstrap.fobs.find((item) => String(item.id) === String(this.getData().id));
      if (!fob) {
        return;
      }

      await this.onFobUpdate(fob);
    } catch (error) {
      this.error(error);
    }
  }

  async onFobUpdate(payload) {
    try {
      const wirelessBattery = payload
        && payload.wirelessConnectionState
        && payload.wirelessConnectionState.batteryStatus;
      const batteryStatus = payload && payload.batteryStatus;
      const percentage = wirelessBattery && typeof wirelessBattery.percentage !== 'undefined'
        ? wirelessBattery.percentage
        : (batteryStatus && typeof batteryStatus.percentage !== 'undefined' ? batteryStatus.percentage : null);

      if (percentage !== null && this.hasCapability('measure_battery')) {
        const normalized = Math.max(0, Math.min(100, Number(percentage)));
        await this.setCapabilityValue('measure_battery', normalized);
      }
    } catch (error) {
      this.error(error);
    }
  }

  async onFobButtonEvent(event) {
    try {
      await this.setStoreValue('last_fob_button', event.button);
      await this.setStoreValue('last_fob_press_type', event.pressType);
      await this.setStoreValue('last_fob_timestamp', event.timestamp);
      this.driver.triggerFobButton(this, event);
    } catch (error) {
      this.error(error);
    }
  }
}

Object.assign(ProtectFobDevice.prototype, ConnectionMonitorMixin);

module.exports = ProtectFobDevice;

