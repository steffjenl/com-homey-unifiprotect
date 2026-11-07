'use strict';

const Homey = require('homey');
const ConnectionMonitorMixin = require('../../library/ConnectionMonitorMixin');
const UfvConstants = require('../../library/constants');
const {
  DOOR_STATE_OPEN, DOOR_STATE_CLOSED, DOOR_STATE_UNKNOWN, normalizeDoorState,
} = require('../../library/door-state');
const { GATE_BUTTONS, buttonsForMode, toggleCommand } = require('../../library/gate-control');

class MyDevice extends Homey.Device {

  /**
     * onInit is called when the device is initialized.
     */
  async onInit() {
    this._startConnectionMonitoring('access');
    this._doorState = DOOR_STATE_UNKNOWN;
    if (this.hasCapability('alarm_garagedoor_open')) {
      await this.removeCapability('alarm_garagedoor_open');
    }
    if (!this.hasCapability('garagedoor_closed')) {
      await this.addCapability('garagedoor_closed');
    }
    //
    this.log('Access Garagedoor has been initialized');
    this.registerCapabilityListener('garagedoor_closed', (value) => this._onGarageDoorToggle(value));
    try {
      await this._applyGateMode(this.getSetting(UfvConstants.SETTING_GATE_CONTROL_MODE));
    } catch (error) {
      this.error(error);
    }
    try {
      const device = await this.homey.app.accessApi.getDoor(this.getData().id);
      if (device && typeof device.data.door_position_status !== 'undefined') {
        await this._applyDoorState(normalizeDoorState(device.data.door_position_status, device.data.dps_connected));
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
    this.log('Access Garagedoor has been added');
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
    this.log('Access Garagedoor settings where changed');
    if (changedKeys.includes(UfvConstants.SETTING_GATE_CONTROL_MODE)) {
      await this._applyGateMode(newSettings[UfvConstants.SETTING_GATE_CONTROL_MODE]);
    }
  }

  /**
   * Tile toggle. In single-pulse mode the hub has one relay action, so the same unlock
   * pulse both opens and closes. In two/three-button mode the requested state picks the
   * operator output via control_cmd. The physical state still comes from the door
   * position sensor (onDoorChange / polling), not from this handler.
   * @param {boolean} requestedClosed
   */
  async _onGarageDoorToggle(requestedClosed) {
    const mode = this.getSetting(UfvConstants.SETTING_GATE_CONTROL_MODE);
    const command = toggleCommand(mode, requestedClosed);
    if (command) {
      this.log(`[AccessGarageDoor] Toggle -> control_cmd=${command}`);
      return this.homey.app.accessApi.setDoorUnLock(this.getData().id, undefined, command);
    }
    this.log('[AccessGarageDoor] Pulsing the door relay');
    return this.homey.app.accessApi.setDoorUnLock(this.getData().id);
  }

  /**
   * Add/remove the Open/Close/Stop device-view buttons for the given gate control mode
   * and make sure each present button has a listener.
   * @param {string} mode
   */
  async _applyGateMode(mode) {
    const wantedOrder = buttonsForMode(mode);
    const wanted = new Set(wantedOrder);
    const present = this.getCapabilities().filter((capability) => capability in GATE_BUTTONS);

    // Homey lists capabilities in the order they were added. If the buttons are not
    // exactly the wanted ones in the wanted order (e.g. two → three buttons would append
    // Stop after Close), rebuild them so the view reads Open | Stop | Close.
    if (present.join(',') !== wantedOrder.join(',')) {
      for (const capability of present) {
        await this.removeCapability(capability);
      }
      for (const capability of wantedOrder) {
        await this.addCapability(capability);
      }
    }
    if (!this._gateButtonListeners) this._gateButtonListeners = new Set();
    for (const capability of wanted) {
      if (!this._gateButtonListeners.has(capability)) {
        this.registerCapabilityListener(capability, () => this._onGateButton(capability));
        this._gateButtonListeners.add(capability);
      }
    }
  }

  async _onGateButton(capability) {
    const command = GATE_BUTTONS[capability];
    this.log(`[AccessGarageDoor] Button ${capability} -> control_cmd=${command}`);
    return this.homey.app.accessApi.setDoorUnLock(this.getData().id, undefined, command);
  }

  /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
  async onRenamed(name) {
    this.log('Access Garagedoor was renamed');
  }

  /**
     * onDeleted is called when the user deleted the device.
     */
  async onDeleted() {
    this._stopDoorStatePolling();
    this.log('Access Garagedoor has been deleted');
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
    // Gate/garage hubs report a relay lock state here, but there is no separate
    // "locked" capability on this device class — the open/closed state (below)
    // is what drives the tile and the flow cards.
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
      await this.setCapabilityValue('garagedoor_closed', nextState === DOOR_STATE_CLOSED);
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
        this.driver.triggerGarageDoorOpened(this, {}, {});
      } else {
        this.driver.triggerGarageDoorClosed(this, {}, {});
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
