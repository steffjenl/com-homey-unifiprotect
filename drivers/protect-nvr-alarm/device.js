'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class NVRAlarmDevice extends Homey.Device {

  async onInit() {
    this.homey.app.debug('[NVRAlarmDevice] initializing');
    await this._createMissingCapabilities();
    await this.waitForBootstrap();
  }

  async onAdded() {
    this.homey.app.debug('[NVRAlarmDevice] added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.homey.app.debug('[NVRAlarmDevice] settings changed');
  }

  async onRenamed(name) {
    this.homey.app.debug('[NVRAlarmDevice] renamed');
  }

  async onDeleted() {
    this.homey.app.debug('[NVRAlarmDevice] deleted');
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
    this.homey.app.debug('[NVRAlarmDevice] initDevice');

    // Register capability listener for homealarm_state (user sets via Homey UI)
    this.registerCapabilityListener('homealarm_state', async (value) => {
      this.homey.app.debug(`[NVRAlarmDevice] homealarm_state set to: ${value}`);
      const isAway = (value === 'armed');
      return this.setNvrAwayMode(isAway);
    });

    await this._initDeviceData();
  }

  async _createMissingCapabilities() {
    if (!this.hasCapability('homealarm_state')) {
      await this.addCapability('homealarm_state');
      this.homey.app.debug('[NVRAlarmDevice] added homealarm_state capability');
    }
    if (!this.hasCapability('alarm_generic')) {
      await this.addCapability('alarm_generic');
      this.homey.app.debug('[NVRAlarmDevice] added alarm_generic capability');
    }
  }

  async _initDeviceData() {
    // Read arm state from bootstrap nvr.armMode (via getNvrArmState which reads bootstrap first)
    try {
      const armState = await this.homey.app.api.getNvrArmState();
      this.homey.app.debug(`[NVRAlarmDevice] arm state: ${JSON.stringify(armState)}`);

      // Primary shape from bootstrap nvr.armMode: { status: 'armed'|'disarmed', armProfileId, ... }
      let isAway = false;
      if (typeof armState.status !== 'undefined') {
        isAway = armState.status === 'armed';
      } else if (typeof armState.isEnabled !== 'undefined') {
        isAway = armState.isEnabled === true;
      } else if (typeof armState.isAway !== 'undefined') {
        isAway = armState.isAway === true;
      }

      await this._applyAlarmState(isAway, false);
    } catch (error) {
      this.error(`[NVRAlarmDevice] getNvrArmState failed, falling back to bootstrap nvr.isAway: ${error.message}`);
      const bootstrap = this.homey.app.api.getBootstrap();
      if (bootstrap && bootstrap.nvr) {
        const isAway = bootstrap.nvr.isAway === true;
        this.homey.app.debug(`[NVRAlarmDevice] bootstrap isAway fallback: ${isAway}`);
        await this._applyAlarmState(isAway, false);
      }
    }
  }

  /**
   * Called when the NVR arm state changes (from websocket NVR update).
   * Accepts either a boolean (legacy isAway) or an armMode object { status: 'armed'|'disarmed'|'breach' }.
   * @param {boolean|object} armStateOrIsAway
   */
  async onAlarmStateChanged(armStateOrIsAway) {
    this.homey.app.debug(`[NVRAlarmDevice] onAlarmStateChanged: ${JSON.stringify(armStateOrIsAway)}`);

    if (typeof armStateOrIsAway === 'object' && armStateOrIsAway !== null) {
      if (armStateOrIsAway.status === 'breach') {
        await this._applyBreachState(true);
        return;
      }
      const isAway = armStateOrIsAway.status === 'armed';
      await this._applyAlarmState(isAway, true);
    } else {
      const isAway = armStateOrIsAway === true;
      await this._applyAlarmState(isAway, true);
    }
  }

  /**
   * Apply the alarm state to capabilities and optionally fire flow triggers.
   * @param {boolean} isAway
   * @param {boolean} triggerFlows
   */
  async _applyAlarmState(isAway, triggerFlows) {
    try {
      const homeyAlarmState = isAway ? 'armed' : 'disarmed';
      const currentState = this.getCapabilityValue('homealarm_state');

      if (currentState !== homeyAlarmState) {
        await this.setCapabilityValue('homealarm_state', homeyAlarmState);

        // Reset alarm_generic when disarmed (clears any active breach)
        if (!isAway) {
          await this.setCapabilityValue('alarm_generic', false);
        }

        if (triggerFlows) {
          const stateLabel = isAway ? 'armed' : 'disarmed';

          // Trigger: state changed
          this.driver.homey.flow
            .getDeviceTriggerCard(UfvConstants.EVENT_NVR_ALARM_STATE_CHANGED)
            .trigger(this, { state: stateLabel })
            .catch((err) => this.error(err));

          // Trigger: armed or disarmed
          if (isAway) {
            this.driver.homey.flow
              .getDeviceTriggerCard(UfvConstants.EVENT_NVR_ALARM_ARMED)
              .trigger(this)
              .catch((err) => this.error(err));
          } else {
            this.driver.homey.flow
              .getDeviceTriggerCard(UfvConstants.EVENT_NVR_ALARM_DISARMED)
              .trigger(this)
              .catch((err) => this.error(err));
          }
        }
      }
    } catch (error) {
      this.error(`[NVRAlarmDevice] _applyAlarmState error: ${error.message}`);
    }
  }

  /**
   * Apply a breach state: homealarm_state stays 'armed', alarm_generic is set to true,
   * and the breach flow trigger fires.
   * @param {boolean} triggerFlows
   */
  async _applyBreachState(triggerFlows) {
    try {
      this.homey.app.debug('[NVRAlarmDevice] _applyBreachState');

      // Ensure homealarm_state reflects armed (NVR is still armed during breach)
      if (this.getCapabilityValue('homealarm_state') !== 'armed') {
        await this.setCapabilityValue('homealarm_state', 'armed');
      }

      await this.setCapabilityValue('alarm_generic', true);

      if (triggerFlows) {
        // Trigger: state changed (with 'breach' as state token)
        this.driver.homey.flow
          .getDeviceTriggerCard(UfvConstants.EVENT_NVR_ALARM_STATE_CHANGED)
          .trigger(this, { state: 'breach' })
          .catch((err) => this.error(err));

        // Trigger: breach
        this.driver.homey.flow
          .getDeviceTriggerCard(UfvConstants.EVENT_NVR_ALARM_BREACH)
          .trigger(this)
          .catch((err) => this.error(err));
      }
    } catch (error) {
      this.error(`[NVRAlarmDevice] _applyBreachState error: ${error.message}`);
    }
  }

  /**
   * Set the NVR away mode via the v1 API (POST arm/enable or arm/disable).
   * @param {boolean} isAway
   * @returns {Promise}
   */
  async setNvrAwayMode(isAway) {
    this.homey.app.debug(`[NVRAlarmDevice] setNvrAwayMode: ${isAway}`);
    return this.homey.app.api.setNvrAwayMode(isAway)
      .then(() => {
        this.homey.app.debug('[NVRAlarmDevice] setNvrAwayMode success');
        return this._applyAlarmState(isAway, true);
      })
      .catch((error) => {
        this.error(`[NVRAlarmDevice] setNvrAwayMode error: ${error.message}`);
        return Promise.reject(error);
      });
  }

}

module.exports = NVRAlarmDevice;
