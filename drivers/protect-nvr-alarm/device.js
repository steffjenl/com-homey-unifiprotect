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
        if (
            typeof this.homey.app.api.getLastUpdateId() !== 'undefined'
            && this.homey.app.api.getLastUpdateId() !== null
        ) {
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
            // Map Homey alarm state to NVR isAway
            // 'armed_away' or 'armed_home' -> away=true, 'disarmed' -> away=false
            const isAway = (value === 'armed_away' || value === 'armed_home');
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
        const bootstrap = this.homey.app.api.getBootstrap();
        if (bootstrap && bootstrap.nvr) {
            const isAway = bootstrap.nvr.isAway === true;
            this.homey.app.debug(`[NVRAlarmDevice] initial isAway: ${isAway}`);
            await this._applyAlarmState(isAway, false);
        }
    }

    /**
     * Called when the NVR isAway field changes (from v1 websocket or poll).
     * @param {boolean} isAway
     */
    async onAlarmStateChanged(isAway) {
        this.homey.app.debug(`[NVRAlarmDevice] onAlarmStateChanged: ${isAway}`);
        await this._applyAlarmState(isAway, true);
    }

    /**
     * Apply the alarm state to capabilities and fire flow triggers.
     * @param {boolean} isAway
     * @param {boolean} triggerFlows - fire trigger cards when true
     */
    async _applyAlarmState(isAway, triggerFlows) {
        try {
            const homeyAlarmState = isAway ? 'armed_away' : 'disarmed';
            const currentState = this.getCapabilityValue('homealarm_state');

            if (currentState !== homeyAlarmState) {
                await this.setCapabilityValue('homealarm_state', homeyAlarmState);
                await this.setCapabilityValue('alarm_generic', isAway);

                if (triggerFlows) {
                    const stateLabel = isAway ? 'armed' : 'disarmed';

                    // Trigger: state changed
                    this.driver.homey.flow
                        .getDeviceTriggerCard(UfvConstants.EVENT_NVR_ALARM_STATE_CHANGED)
                        .trigger(this, { state: stateLabel })
                        .catch(this.error.bind(this));

                    // Trigger: armed or disarmed
                    if (isAway) {
                        this.driver.homey.flow
                            .getDeviceTriggerCard(UfvConstants.EVENT_NVR_ALARM_ARMED)
                            .trigger(this)
                            .catch(this.error.bind(this));
                    } else {
                        this.driver.homey.flow
                            .getDeviceTriggerCard(UfvConstants.EVENT_NVR_ALARM_DISARMED)
                            .trigger(this)
                            .catch(this.error.bind(this));
                    }
                }
            }
        } catch (error) {
            this.error('[NVRAlarmDevice] _applyAlarmState error: ' + error.message);
        }
    }

    /**
     * Set the NVR away mode via the v1 API.
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
            .catch(error => {
                this.error('[NVRAlarmDevice] setNvrAwayMode error: ' + error.message);
                return Promise.reject(error);
            });
    }
}

module.exports = NVRAlarmDevice;

