'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

// Constants
const BOOTSTRAP_POLL_INTERVAL_MS = 250;

/**
 * UniFi Protect Light Device Driver
 * 
 * Manages UniFi Protect light/floodlight devices, providing on/off,
 * brightness control, and mode selection (always on, motion-activated, manual).
 * 
 * @class Light
 * @extends {Homey.Device}
 */
class Light extends Homey.Device {
    /**
     * Initialize the light device.
     * 
     * Called when the device is initialized. Waits for bootstrap data
     * before completing initialization.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        await this.waitForBootstrap();
        this.homey.app.debug('UnifiLight Device has been initialized');
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
        this.homey.app.debug('UnifiLight Device has been added');
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
    async onSettings({ oldSettings, newSettings, changedKeys }) {
        this.homey.app.debug('UnifiLight Device settings where changed');
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
        this.homey.app.debug('UnifiLight Device was renamed');
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
        this.homey.app.debug('UnifiLight Device has been deleted');
    }

    /**
     * Initialize light-specific functionality.
     * 
     * Sets up capability listeners for on/off, brightness, and mode controls,
     * creates missing capabilities, and initializes light data.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async initLight() {
        this._registerCapabilityListeners();
        await this._createMissingCapabilities();
        await this._initLightData();
    }

    /**
     * Register capability listeners for light controls.
     * @private
     */
    _registerCapabilityListeners() {
        // On/Off control
        this.registerCapabilityListener("onoff", (value) => {
            return this.homey.app.api.setLightOn(this.getData(), value);
        });

        // Brightness control
        this.registerCapabilityListener("dim", (value) => {
            return this.homey.app.api.setLightLevel(this.getData(), this.translateLedLevel(value, true));
        });

        // Light mode control (manual, motion, always)
        this.registerCapabilityListener("light_mode_unifi", (value) => {
            return this.homey.app.api.setLightMode(this.getData(), value);
        });
    }

    /**
     * Wait for bootstrap data to become available.
     * 
     * Polls until the API has bootstrap data loaded, then initializes the light.
     * Uses recursive timeout to avoid blocking.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async waitForBootstrap() {
        const lastUpdateId = this.homey.app.api.getLastUpdateId();
        
        if (typeof lastUpdateId !== 'undefined' && lastUpdateId !== null) {
            await this.initLight();
        } else {
            this.homey.setTimeout(this.waitForBootstrap.bind(this), BOOTSTRAP_POLL_INTERVAL_MS);
        }
    }

    /**
     * Create missing capabilities for the light device.
     * 
     * Ensures the device has all required capabilities and correct device class.
     * 
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _createMissingCapabilities() {
        // Ensure device class is set to 'light'
        if (this.getClass() !== 'light') {
            this.homey.app.debug(`changed class to light for ${this.getName()}`);
            await this.setClass('light');
        }
        
        // Add UniFi light mode capability
        if (!this.hasCapability('light_mode_unifi')) {
            await this.addCapability('light_mode_unifi');
            this.homey.app.debug(`created capability light_mode_unifi for ${this.getName()}`);
        }
    }

    /**
     * Initialize light data from bootstrap.
     * 
     * Loads current on/off state, brightness, and mode from the API bootstrap data.
     * 
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _initLightData() {
        const bootstrapData = this.homey.app.api.getBootstrap();
        if (!bootstrapData || !bootstrapData.lights) return;
        
        const light = this._findLightInBootstrap(bootstrapData);
        if (light) {
            this._updateLightCapabilities(light);
        }
    }

    /**
     * Find this light in the bootstrap data.
     * @private
     * @param {Object} bootstrapData - The bootstrap data
     * @returns {Object|null} The light data or null if not found
     */
    _findLightInBootstrap(bootstrapData) {
        return bootstrapData.lights.find(light => 
            light.id === this.getData().id
        ) || null;
    }

    /**
     * Update light capabilities from device data.
     * @private
     * @param {Object} light - The light data from API
     */
    _updateLightCapabilities(light) {
        if (this.hasCapability('onoff')) {
            this.setCapabilityValue('onoff', light.isLightOn);
        }
        
        if (this.hasCapability('dim')) {
            const brightness = this.translateLedLevel(light.lightDeviceSettings.ledLevel, false);
            this.setCapabilityValue('dim', brightness);
        }
        
        if (this.hasCapability('light_mode_unifi')) {
            const mode = this.translateLightMode(light.lightModeSettings);
            this.setCapabilityValue('light_mode_unifi', mode);
        }
    }

    /**
     * Handle motion start event.
     * 
     * Called when motion is detected by the light's PIR sensor.
     */
    onMotionStart() {
        this.homey.app.debug('onMotionStart');
        this.setCapabilityValue('alarm_motion', true);
    }

    /**
     * Handle motion end event.
     * 
     * Called when motion detection ends (timeout period elapsed).
     */
    onMotionEnd() {
        this.homey.app.debug('onMotionEnd');
        this.setCapabilityValue('alarm_motion', false);
    }

    /**
     * Handle light on/off state change from external event.
     * 
     * Called by the app when light state changes are detected
     * via websocket or API polling.
     * 
     * @param {boolean} isLightOn - The new light state
     */
    onIsLightOn(isLightOn) {
        if (this.hasCapability('onoff')) {
            this.setCapabilityValue('onoff', isLightOn);
        }
    }

    /**
     * Handle LED brightness level change from external event.
     * 
     * Called by the app when brightness changes are detected
     * via websocket or API polling.
     * 
     * @param {number} ledLevel - The new LED level (1-6)
     */
    onLedLevelChange(ledLevel) {
        this.homey.app.debug('onLedLevelChange');
        if (this.hasCapability('dim')) {
            this.setCapabilityValue('dim', this.translateLedLevel(ledLevel, false));
        }
    }

    /**
     * Handle light mode change from external event.
     * 
     * Called by the app when mode changes are detected
     * via websocket or API polling.
     * 
     * @param {Object} settings - The light mode settings
     */
    onLightModeChange(settings) {
        this.homey.app.debug('onLightModeChange');
        if (this.hasCapability('light_mode_unifi')) {
            this.setCapabilityValue('light_mode_unifi', this.translateLightMode(settings));
        }
    }

    /**
     * Translate UniFi light mode settings to Homey mode value.
     * 
     * Maps UniFi's mode and enableAt settings to simplified mode strings:
     * - "motion" (fulltime): Motion-activated anytime
     * - "dark": Motion-activated only when dark
     * - Other modes: Pass through (manual, always, etc.)
     * 
     * @param {Object} settings - Light mode settings from UniFi
     * @param {string} settings.mode - The mode (motion, manual, etc.)
     * @param {string} settings.enableAt - When to enable (fulltime, dark)
     * @returns {string} The Homey-compatible mode string
     */
    translateLightMode(settings) {
        if (settings.mode === "motion" && settings.enableAt === "fulltime") {
            return "motion";
        } else if (settings.mode === "motion" && settings.enableAt === "dark") {
            return "dark";
        } else {
            return settings.mode;
        }
    }

    /**
     * Translate between UniFi LED levels (1-6) and Homey brightness (0.0-1.0).
     * 
     * UniFi devices use discrete LED levels 1-6, while Homey uses
     * continuous 0.0-1.0 brightness. This method maps between them.
     * 
     * @param {number} ledLevel - The level to translate
     * @param {boolean} homey - Translation direction: true = Homey→UniFi, false = UniFi→Homey
     * @returns {number} The translated level
     */
    translateLedLevel(ledLevel, homey) {
        if (homey) {
            // Homey (0.0-1.0) to UniFi (1-6)
            if (ledLevel <= 0.16) return 1;
            if (ledLevel <= 0.32) return 2;
            if (ledLevel <= 0.48) return 3;
            if (ledLevel <= 0.64) return 4;
            if (ledLevel <= 0.80) return 5;
            return 6;
        } else {
            // UniFi (1-6) to Homey (0.0-1.0)
            const LED_LEVEL_MAP = {
                1: 0.16,
                2: 0.32,
                3: 0.48,
                4: 0.64,
                5: 0.80,
                6: 1.00
            };
            return LED_LEVEL_MAP[ledLevel] || 1.00;
        }
    }

    /**
     * Handle motion detection events from UniFi Protect.
     * 
     * Processes motion start/end events, updates last motion timestamps,
     * and triggers motion alarms in Homey.
     * 
     * @param {number} lastMotionTime - Unix timestamp of the motion event
     * @param {boolean} isMotionDetected - True for motion start, false for motion end
     */
    onMotionDetected(lastMotionTime, isMotionDetected) {
        const lastMotionAt = this.getCapabilityValue('last_motion_at');

        // Initialize last_motion_at if not set
        if (!lastMotionAt) {
            this.homey.app.debug(`set last_motion_at to last datetime: ${this.getData().id}`);
            this.setCapabilityValue('last_motion_at', lastMotionTime).catch(this.error);
            return;
        }

        // Only process events newer than the last recorded motion
        if (lastMotionTime <= lastMotionAt) {
            return;
        }

        const lastMotion = this.homey.app.toLocalTime(new Date(lastMotionTime));

        if (isMotionDetected) {
            this._handleMotionStart(lastMotionTime, lastMotion);
        } else {
            this._handleMotionEnd(lastMotionTime, lastMotion);
        }
    }

    /**
     * Handle motion start event with timestamp updates.
     * @private
     * @param {number} lastMotionTime - Unix timestamp
     * @param {Date} lastMotion - Localized Date object
     */
    _handleMotionStart(lastMotionTime, lastMotion) {
        this.homey.app.debug(`new motion detected on light: ${this.getData().id} on ${lastMotion.toLocaleString()}`);

        this.setCapabilityValue('last_motion_at', lastMotionTime).catch(this.error);
        this.setCapabilityValue('last_motion_date', lastMotion.toLocaleDateString()).catch(this.error);
        this.setCapabilityValue('last_motion_time', lastMotion.toLocaleTimeString()).catch(this.error);
        this.onMotionStart();
    }

    /**
     * Handle motion end event with timestamp update.
     * @private
     * @param {number} lastMotionTime - Unix timestamp
     * @param {Date} lastMotion - Localized Date object
     */
    _handleMotionEnd(lastMotionTime, lastMotion) {
        this.homey.app.debug(`motion detected ended on light: ${this.getData().id} on ${lastMotion.toLocaleString()}`);
        
        this.setCapabilityValue('last_motion_at', lastMotionTime).catch(this.error);
        this.onMotionEnd();
    }
}

module.exports = Light;
