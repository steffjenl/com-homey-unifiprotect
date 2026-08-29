'use strict';

const Homey = require('homey');
const ConnectionMonitorMixin = require('../../library/ConnectionMonitorMixin');
const UfvConstants = require('../../library/constants');
const { DOOR_STATE_OPEN, DOOR_STATE_CLOSED, DOOR_STATE_UNKNOWN, normalizeDoorState } = require('../../library/door-state');

class MyDevice extends Homey.Device {

  /**
     * onInit is called when the device is initialized.
     */
  async onInit() {
    this._startConnectionMonitoring('access');
    this._doorState = DOOR_STATE_UNKNOWN;
    this.log('Access Door has been initialized');
    this.registerCapabilityListener('locked', async (value) => {
      this.homey.app.debug(`[AccessDoorDevice] Setting Door Locked to ${value}`);
      if (value) {
        this.log('Locking the door');
        return this.homey.app.accessApi.setTempDoorLockingRule(this.getData().id, 'lock_now');
      }
      this.log('Unlocking the door');
      return this.homey.app.accessApi.setDoorUnLock(this.getData().id);

    });
    try {
      const device = await this.homey.app.accessApi.getDoor(this.getData().id);
      if (device) {
        if (typeof device.data.door_lock_relay_status !== 'undefined') {
          this.setCapabilityValue('locked', device.data.door_lock_relay_status !== 'locked').catch(this.error);
        }
        if (typeof device.data.door_position_status !== 'undefined') {
          await this._applyDoorState(normalizeDoorState(device.data.door_position_status, device.data.dps_connected));
        }
      }
    } catch (error) {
      this.error(error);
    }
    this._startDoorStatePolling();
  }

  /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
  async onAdded() {
    this.log('Access Door has been added');
  }

  /**
     * onSettings is called when the user updates the device's settings.
     * @param {object} event the onSettings event data
     * @param {object} event.oldSettings The old settings object
     * @param {object} event.newSettings The new settings object
     * @param {string[]} event.changedKeys An array of keys changed since the previous version
     * @returns {Promise<string|void>} return a custom message that will be displayed
     */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Access Door settings where changed');
  }

  /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
  async onRenamed(name) {
    this.log('Access Door was renamed');
  }

  /**
     * onDeleted is called when the user deleted the device.
     */
  async onDeleted() {
    this._stopDoorStatePolling();
    this.log('Access Door has been deleted');
  }

  async onUninit() {
    this._stopDoorStatePolling();
  }

  _startDoorStatePolling() {
    this._stopDoorStatePolling();
    this._doorStatePollInterval = this.homey.setInterval(() => {
      this.homey.app.accessApi.getDoor(this.getData().id)
        .then((device) => {
          if (device && typeof device.data.door_position_status !== 'undefined') {
            return this._applyDoorState(normalizeDoorState(device.data.door_position_status, device.data.dps_connected));
          }
          return undefined;
        })
        .catch(this.error);
    }, UfvConstants.ACCESS_DOOR_POLL_INTERVAL_MS);
  }

  _stopDoorStatePolling() {
    if (this._doorStatePollInterval) {
      this.homey.clearInterval(this._doorStatePollInterval);
      this._doorStatePollInterval = null;
    }
  }

  onLockChange(value) {
    this.setCapabilityValue('locked', value).catch(this.error);
  }

  onDoorChange(rawDps, dpsConnected) {
    this._applyDoorState(normalizeDoorState(rawDps, dpsConnected)).catch(this.error);
  }

  /**
   * Apply a normalised door state, updating the capability and firing the
   * opened/closed trigger exactly once per real transition.
   * @param {'open'|'closed'|'unknown'} nextState
   */
  async _applyDoorState(nextState) {
    if (nextState === DOOR_STATE_UNKNOWN) {
      return;
    }

    const previous = this._doorState;
    // Set the new state before awaiting anything so a second event arriving
    // while setCapabilityValue() is still pending sees the up-to-date value
    // instead of racing against this one and double-firing the trigger.
    this._doorState = nextState;

    try {
      await this.setCapabilityValue('alarm_contact', nextState === DOOR_STATE_OPEN);
    } catch (error) {
      this.error(error);
    }

    // Don't trigger on the first known reading, or when nothing actually changed.
    if (previous === DOOR_STATE_UNKNOWN || previous === nextState) {
      return;
    }

    try {
      await this.driver.ready();
      if (nextState === DOOR_STATE_OPEN) {
        this.driver.triggerDoorOpened(this, {}, {});
      } else {
        this.driver.triggerDoorClosed(this, {}, {});
      }
    } catch (error) {
      this.error(error);
    }
  }

  isDoorOpen() {
    return this._doorState === DOOR_STATE_OPEN;
  }

  isDoorClosed() {
    return this._doorState === DOOR_STATE_CLOSED;
  }

}

Object.assign(MyDevice.prototype, ConnectionMonitorMixin);

module.exports = MyDevice;
