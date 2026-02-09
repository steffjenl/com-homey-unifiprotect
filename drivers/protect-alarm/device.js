'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

// Constants
const BOOTSTRAP_POLL_INTERVAL_MS = 250;
const ALARM_CHECK_DEBOUNCE_MS = 2000;

/**
 * UniFi Protect Alarm Manager Device
 *
 * Manages UniFi Protect alarm system state, providing arm/disarm functionality,
 * alarm event triggers, and integration with Homey's security system.
 *
 * @class ProtectAlarmDevice
 * @extends {Homey.Device}
 */
class ProtectAlarmDevice extends Homey.Device {
    /**
     * Initialize the alarm device.
     *
     * Called when the device is initialized. Waits for bootstrap data
     * before completing initialization.
     *
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        this.lastAlarmAt = null;
        this.alarmCheckTimer = null;

        await this.waitForBootstrap();
        this.homey.app.debug('UniFi Protect Alarm Manager Device has been initialized');
    }

    /**
     * Handle device addition.
     *
     * Called when the user adds the device, just after pairing completes.
     *
     * @async
     * @returns {Promise<void>}
     */
    async onAdded() {
        this.homey.app.debug('UniFi Protect Alarm Manager Device has been added');
    }

    /**
     * Handle device settings changes.
     *
     * Called when the user updates the device's settings in the Homey app.
     *
     * @async
     * @param {Object} event - The onSettings event data
     * @param {Object} event.oldSettings - The previous settings object
     * @param {Object} event.newSettings - The updated settings object
     * @param {string[]} event.changedKeys - Array of keys that changed
     * @returns {Promise<string|void>} Optional custom message to display to user
     */
    async onSettings({oldSettings, newSettings, changedKeys}) {
        this.homey.app.debug('UniFi Protect Alarm Manager Device settings were changed');
    }

    /**
     * Handle device rename.
     *
     * Called when the user updates the device's name.
     * Can be used to synchronize the name with the physical device.
     *
     * @async
     * @param {string} name - The new device name
     * @returns {Promise<void>}
     */
    async onRenamed(name) {
        this.homey.app.debug('UniFi Protect Alarm Manager Device was renamed');
    }

    /**
     * Handle device deletion.
     *
     * Called when the user deletes the device from Homey.
     *
     * @async
     * @returns {Promise<void>}
     */
    async onDeleted() {
        if (this.alarmCheckTimer) {
            this.homey.clearTimeout(this.alarmCheckTimer);
            this.alarmCheckTimer = null;
        }
        this.homey.app.debug('UniFi Protect Alarm Manager Device has been deleted');
    }

    /**
     * Initialize alarm-specific functionality.
     *
     * Sets up capability listeners for alarm control,
     * creates missing capabilities, and initializes alarm data.
     *
     * @async
     * @returns {Promise<void>}
     */
    async initAlarm() {
        this._registerCapabilityListeners();
        await this._createMissingCapabilities();
        await this._initAlarmData();
    }

    /**
     * Register capability listeners for alarm controls.
     * @private
     */
    _registerCapabilityListeners() {
        // Alarm state control (armed/disarmed/partial armed)
        this.registerCapabilityListener("homealarm_state", async (value) => {
            return this._setAlarmState(value);
        });
    }

    /**
     * Set the alarm state (arm/disarm).
     *
     * @private
     * @async
     * @param {string} state - The alarm state ('armed', 'disarmed', 'partially_armed')
     * @returns {Promise<void>}
     */
    async _setAlarmState(state) {
        try {
            const enabled = (state === 'armed' || state === 'partially_armed');
            await this.homey.app.apiV2.setNVR(this.getData().id, {
                isAlarmsEnabled: enabled
            });

            this.homey.app.debug(`Alarm state set to: ${state} (enabled: ${enabled})`);
            return Promise.resolve();
        } catch (error) {
            this.homey.app.error('Error setting alarm state:', error);
            return Promise.reject(error);
        }
    }

    /**
     * Wait for bootstrap data to become available.
     *
     * Polls until the API has bootstrap data loaded, then initializes the alarm.
     * Uses recursive timeout to avoid blocking.
     *
     * @async
     * @returns {Promise<void>}
     */
    async waitForBootstrap() {
        const lastUpdateId = this.homey.app.api.getLastUpdateId();

        if (typeof lastUpdateId !== 'undefined' && lastUpdateId !== null) {
            await this.initAlarm();
        } else {
            this.homey.setTimeout(this.waitForBootstrap.bind(this), BOOTSTRAP_POLL_INTERVAL_MS);
        }
    }

    /**
     * Create missing capabilities for the alarm device.
     *
     * Ensures the device has all required capabilities and correct device class.
     *
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _createMissingCapabilities() {
        if (this.getClass() !== 'homealarm') {
            this.homey.app.debug(`changed class to homealarm for ${this.getName()}`);
            await this.setClass('homealarm');
        }

        // Ensure homealarm_state capability exists
        if (!this.hasCapability('homealarm_state')) {
            await this.addCapability('homealarm_state');
            this.homey.app.debug(`added capability homealarm_state for ${this.getName()}`);
        }

        // Ensure alarm_generic capability exists
        if (!this.hasCapability('alarm_generic')) {
            await this.addCapability('alarm_generic');
            this.homey.app.debug(`added capability alarm_generic for ${this.getName()}`);
        }
    }

    /**
     * Initialize alarm data from bootstrap or API.
     *
     * Loads current alarm state from the API.
     *
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _initAlarmData() {
        try {
            const nvrs = await this.homey.app.apiV2.getNVR();
            if (!nvrs || nvrs.length === 0) {
                return;
            }

            const nvr = nvrs.find(n => String(n.id) === String(this.getData().id));
            if (nvr) {
                this._updateAlarmCapabilities(nvr);
            }
        } catch (error) {
            this.homey.app.error('Error initializing alarm data:', error);
        }
    }

    /**
     * Update alarm capabilities from NVR data.
     * @private
     * @param {Object} nvr - The NVR data from API
     */
    _updateAlarmCapabilities(nvr) {
        // Update alarm state
        if (this.hasCapability('homealarm_state')) {
            const alarmState = nvr.isAlarmsEnabled ? 'armed' : 'disarmed';
            this.setCapabilityValue('homealarm_state', alarmState).catch(this.error);
        }

        // Track last alarm timestamp
        if (nvr.lastAlarmAt) {
            this._checkForNewAlarm(nvr.lastAlarmAt);
        }
    }

    /**
     * Check if there's a new alarm event.
     *
     * @private
     * @param {number} lastAlarmAt - Timestamp of last alarm
     */
    _checkForNewAlarm(lastAlarmAt) {
        if (!lastAlarmAt) return;

        // Check if this is a new alarm (not seen before or newer than last one)
        if (!this.lastAlarmAt || lastAlarmAt > this.lastAlarmAt) {
            this.lastAlarmAt = lastAlarmAt;

            // Debounce alarm triggers to prevent duplicates
            if (this.alarmCheckTimer) {
                this.homey.clearTimeout(this.alarmCheckTimer);
            }

            this.alarmCheckTimer = this.homey.setTimeout(() => {
                this.onAlarmTriggered(lastAlarmAt);
                this.alarmCheckTimer = null;
            }, ALARM_CHECK_DEBOUNCE_MS);
        }
    }

    /**
     * Handle alarm state change from external event.
     *
     * Called by the app when alarm state changes are detected
     * via websocket or API polling.
     *
     * @param {boolean} isEnabled - Whether alarms are enabled
     */
    onAlarmStateChange(isEnabled) {
        this.homey.app.debug(`Alarm state changed: ${isEnabled ? 'armed' : 'disarmed'}`);

        if (this.hasCapability('homealarm_state')) {
            const alarmState = isEnabled ? 'armed' : 'disarmed';
            this.setCapabilityValue('homealarm_state', alarmState).catch(this.error);
        }
    }

    /**
     * Handle alarm triggered event.
     *
     * Called when an alarm is triggered in the UniFi Protect system.
     * Sets the alarm_generic capability and can trigger flow cards.
     *
     * @param {number} timestamp - The timestamp when the alarm was triggered
     */
    onAlarmTriggered(timestamp) {
        this.homey.app.debug(`Alarm triggered at: ${new Date(timestamp).toISOString()}`);

        // Set alarm_generic to true
        if (this.hasCapability('alarm_generic')) {
            this.setCapabilityValue('alarm_generic', true).catch(this.error);

            // Auto-reset alarm_generic after a short delay
            this.homey.setTimeout(() => {
                if (this.hasCapability('alarm_generic')) {
                    this.setCapabilityValue('alarm_generic', false).catch(this.error);
                }
            }, 5000);
        }

        // Trigger flow card
        const tokens = {
            timestamp: new Date(timestamp).toISOString()
        };

        this.driver.triggerAlarmTriggered(this, tokens).catch(this.error);
    }
}

module.exports = ProtectAlarmDevice;


