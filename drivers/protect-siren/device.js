'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

// Constants
const BOOTSTRAP_POLL_INTERVAL_MS = 250;
const VOLUME_PERCENTAGE_DIVISOR = 100;

/**
 * UniFi Protect Siren Device Driver
 * 
 * Manages UniFi Protect siren devices, providing volume control
 * for security and notification sirens.
 * 
 * @class Siren
 * @extends {Homey.Device}
 */
class Siren extends Homey.Device {
    /**
     * Initialize the siren device.
     * 
     * Called when the device is initialized. Waits for bootstrap data
     * before completing initialization.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        await this.waitForBootstrap();
        this.homey.app.debug('UniFiSiren Device has been initialized');
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
        this.homey.app.debug('UniFiSiren Device has been added');
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
        this.homey.app.debug('UniFiSiren Device settings where changed');
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
        this.homey.app.debug('UniFiSiren Device was renamed');
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
        this.homey.app.debug('UniFiSiren Device has been deleted');
    }

    /**
     * Initialize siren-specific functionality.
     * 
     * Sets up capability listeners for volume control,
     * creates missing capabilities, and initializes siren data.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async initSiren() {
        this._registerCapabilityListeners();
        await this._createMissingCapabilities();
        await this._initSirenData();
    }

    /**
     * Register capability listeners for siren controls.
     * @private
     */
    _registerCapabilityListeners() {
        // Siren volume control
        this.registerCapabilityListener("siren_volume_set", (value) => {
            return this.homey.app.api.setSirenVolume(this.getData(), value);
        });
    }

    /**
     * Wait for bootstrap data to become available.
     * 
     * Polls until the API has bootstrap data loaded, then initializes the siren.
     * Uses recursive timeout to avoid blocking.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async waitForBootstrap() {
        const lastUpdateId = this.homey.app.api.getLastUpdateId();
        
        if (typeof lastUpdateId !== 'undefined' && lastUpdateId !== null) {
            await this.initSiren();
        } else {
            this.homey.setTimeout(this.waitForBootstrap.bind(this), BOOTSTRAP_POLL_INTERVAL_MS);
        }
    }

    /**
     * Create missing capabilities for the siren device.
     * 
     * Ensures the device has all required capabilities and correct device class.
     * 
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _createMissingCapabilities() {
        if (this.getClass() !== 'siren') {
            this.homey.app.debug(`changed class to siren for ${this.getName()}`);
            await this.setClass('siren');
        }
    }

    /**
     * Initialize siren data from bootstrap.
     * 
     * Loads current volume from the API bootstrap data.
     * 
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _initSirenData() {
        const bootstrapData = this.homey.app.api.getBootstrap();
        if (!bootstrapData || !bootstrapData.sirens) return;
        
        const siren = this._findSirenInBootstrap(bootstrapData);
        if (siren) {
            this._updateSirenCapabilities(siren);
        }
    }

    /**
     * Find this siren in the bootstrap data.
     * @private
     * @param {Object} bootstrapData - The bootstrap data
     * @returns {Object|null} The siren data or null if not found
     */
    _findSirenInBootstrap(bootstrapData) {
        return bootstrapData.sirens.find(siren => 
            siren.id === this.getData().id
        ) || null;
    }

    /**
     * Update siren capabilities from device data.
     * @private
     * @param {Object} siren - The siren data from API
     */
    _updateSirenCapabilities(siren) {
        if (this.hasCapability('siren_volume_set')) {
            const normalizedVolume = siren.volume / VOLUME_PERCENTAGE_DIVISOR;
            this.setCapabilityValue('siren_volume_set', normalizedVolume);
        }
    }

    /**
     * Handle siren volume change from external event.
     * 
     * Called by the app when siren volume changes are detected
     * via websocket or API polling.
     * 
     * @param {number} volume - The new volume level (0-100)
     */
    onIsSirenOn(volume) {
        if (this.hasCapability('siren_volume_set')) {
            const normalizedVolume = volume / VOLUME_PERCENTAGE_DIVISOR;
            this.setCapabilityValue('siren_volume_set', normalizedVolume);
        }
    }
}

module.exports = Siren;
