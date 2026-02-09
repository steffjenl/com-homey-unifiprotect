'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

// Constants
const BOOTSTRAP_POLL_INTERVAL_MS = 250;
const VOLUME_PERCENTAGE_DIVISOR = 100;
const VOLUME_OFF = 0;

/**
 * UniFi Protect Chime Device Driver
 * 
 * Manages UniFi Protect chime devices, providing volume control
 * and on/off functionality for doorbell chimes.
 * 
 * @class Chime
 * @extends {Homey.Device}
 */
class Chime extends Homey.Device {
    /**
     * Initialize the chime device.
     * 
     * Called when the device is initialized. Waits for bootstrap data
     * before completing initialization.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        await this.waitForBootstrap();
        this.homey.app.debug('UnifiChime Device has been initialized');
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
        this.homey.app.debug('UnifiChime Device has been added');
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
        this.homey.app.debug('UnifiChime Device settings where changed');
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
        this.homey.app.debug('UnifiChime Device was renamed');
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
        this.homey.app.debug('UnifiChime Device has been deleted');
    }

    /**
     * Initialize chime-specific functionality.
     * 
     * Sets up capability listeners for volume control and on/off,
     * creates missing capabilities, and initializes chime data.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async initChime() {
        this._registerCapabilityListeners();
        await this._createMissingCapabilities();
        await this._initChimeData();
    }

    /**
     * Register capability listeners for chime controls.
     * @private
     */
    _registerCapabilityListeners() {
        // On/Off control (sets volume to 0 or current setting)
        this.registerCapabilityListener("onoff", (value) => {
            const volume = value === true ? this.getCapabilityValue('volume_set') : VOLUME_OFF;
            return this.homey.app.api.setChimeVolume(this.getData(), volume);
        });

        // Volume control
        this.registerCapabilityListener("volume_set", (value) => {
            return this.homey.app.api.setChimeVolume(this.getData(), value);
        });
    }

    /**
     * Wait for bootstrap data to become available.
     * 
     * Polls until the API has bootstrap data loaded, then initializes the chime.
     * Uses recursive timeout to avoid blocking.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async waitForBootstrap() {
        const lastUpdateId = this.homey.app.api.getLastUpdateId();
        
        if (typeof lastUpdateId !== 'undefined' && lastUpdateId !== null) {
            await this.initChime();
        } else {
            this.homey.setTimeout(this.waitForBootstrap.bind(this), BOOTSTRAP_POLL_INTERVAL_MS);
        }
    }

    /**
     * Create missing capabilities for the chime device.
     * 
     * Ensures the device has all required capabilities and correct device class.
     * 
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _createMissingCapabilities() {
        if (this.getClass() !== 'sensor') {
            this.homey.app.debug(`changed class to sensor for ${this.getName()}`);
            await this.setClass('sensor');
        }
    }

    /**
     * Initialize chime data from bootstrap.
     * 
     * Loads current volume and on/off state from the API bootstrap data.
     * 
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _initChimeData() {
        const bootstrapData = this.homey.app.api.getBootstrap();
        if (!bootstrapData || !bootstrapData.chimes) return;
        
        const chime = this._findChimeInBootstrap(bootstrapData);
        if (chime) {
            this._updateChimeCapabilities(chime);
        }
    }

    /**
     * Find this chime in the bootstrap data.
     * @private
     * @param {Object} bootstrapData - The bootstrap data
     * @returns {Object|null} The chime data or null if not found
     */
    _findChimeInBootstrap(bootstrapData) {
        return bootstrapData.chimes.find(chime => 
            chime.id === this.getData().id
        ) || null;
    }

    /**
     * Update chime capabilities from device data.
     * @private
     * @param {Object} chime - The chime data from API
     */
    _updateChimeCapabilities(chime) {
        const normalizedVolume = chime.volume / VOLUME_PERCENTAGE_DIVISOR;
        
        if (this.hasCapability('onoff')) {
            this.setCapabilityValue('onoff', chime.volume > VOLUME_OFF);
        }
        
        if (this.hasCapability('volume_set')) {
            this.setCapabilityValue('volume_set', normalizedVolume);
        }
    }

    /**
     * Handle chime state change from external event.
     * 
     * Called by the app when chime volume changes are detected
     * via websocket or API polling.
     * 
     * @param {number} volume - The new volume level (0-100)
     */
    onIsChimeOn(volume) {
        const normalizedVolume = volume / VOLUME_PERCENTAGE_DIVISOR;
        
        if (this.hasCapability('onoff')) {
            this.setCapabilityValue('onoff', volume > VOLUME_OFF);
        }
        
        if (this.hasCapability('volume_set')) {
            this.setCapabilityValue('volume_set', normalizedVolume);
        }
    }
}
}

module.exports = Chime;
