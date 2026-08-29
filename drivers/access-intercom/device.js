'use strict';

const Homey = require('homey');
const ConnectionMonitorMixin = require('../../library/ConnectionMonitorMixin');
const { DOOR_STATE_OPEN, DOOR_STATE_UNKNOWN, normalizeDoorState } = require('../../library/door-state');

class IntercomDevice extends Homey.Device {
  async onInit() {
    this._startConnectionMonitoring('access');
    this.log('Access Intercom Device has been initialized');

    this.registerCapabilityListener('locked', async (value) => {
      if (value) {
        return this.homey.app.accessApi.setTempDoorLockingRule(
          this.getData().doorId || this.getData().id,
          'lock_now',
        );
      }
      return this.homey.app.accessApi.setDoorUnLock(this.getData().doorId || this.getData().id);
    });
  }

  async onAdded() {
    this.log('Access Intercom Device has been added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Access Intercom Device settings where changed');
  }

  async onRenamed(name) {
    this.log('Access Intercom Device was renamed');
  }

  async onDeleted() {
    this.log('Access Intercom Device has been deleted');
  }

  onLockChange(value) {
    this.setCapabilityValue('locked', value).catch(this.error);
  }

  onDoorChange(rawDps, dpsConnected) {
    // A Gate/Access Hub without a wired door position sensor reports dps 'none' /
    // dps_connected:false — that is unknown, not closed, so it must not overwrite
    // the last known contact state (see normalizeDoorState()).
    const nextState = normalizeDoorState(rawDps, dpsConnected);
    if (nextState === DOOR_STATE_UNKNOWN) {
      return;
    }
    this.setCapabilityValue('alarm_contact', nextState === DOOR_STATE_OPEN).catch(this.error);
  }

  onBellPressed() {
    this.driver.triggerBellPressed(this);
  }
}

Object.assign(IntercomDevice.prototype, ConnectionMonitorMixin);

module.exports = IntercomDevice;
