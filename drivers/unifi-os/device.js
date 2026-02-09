'use strict';

const Homey = require('homey');

// Constants
const BYTES_TO_GB_DIVISOR = 1000 * 1000 * 1000;

/**
 * UniFi OS Device Driver
 * 
 * Manages UniFi OS console devices (UDM, UNVR, Cloud Key, etc.),
 * providing temperature and storage monitoring capabilities.
 * 
 * @class UniFiOSDevice
 * @extends {Homey.Device}
 */
class UniFiOSDevice extends Homey.Device {

    /**
     * Initialize the UniFi OS device.
     * 
     * Called when the device is initialized. Creates missing capabilities
     * and removes deprecated ones.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        await this._createMissingCapabilities();
        this.log('UniFiOSDevice has been initialized');
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
        this.log('UniFiOSDevice has been added');
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
        this.log('UniFiOSDevice settings where changed');
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
        this.log('UniFiOSDevice was renamed');
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
        this.log('UniFiOSDevice has been deleted');
    }

    /**
     * Create missing capabilities and remove deprecated ones.
     * 
     * Migrates from old storage capabilities (measure_data_size, measure_data_rate,
     * measure_data_size.available) to new ones (measure_data_size.free/used/total).
     * 
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _createMissingCapabilities() {
        // Add new storage capabilities
        await this._addCapabilityIfMissing('measure_data_size.free');
        await this._addCapabilityIfMissing('measure_data_size.used');
        await this._addCapabilityIfMissing('measure_data_size.total');
        
        // Remove deprecated capabilities
        await this._removeCapabilityIfExists('measure_data_size');
        await this._removeCapabilityIfExists('measure_data_rate');
        await this._removeCapabilityIfExists('measure_data_size.available');
    }

    /**
     * Add a capability if it doesn't exist.
     * @private
     * @async
     * @param {string} capability - The capability to add
     * @returns {Promise<void>}
     */
    async _addCapabilityIfMissing(capability) {
        if (!this.hasCapability(capability)) {
            await this.addCapability(capability);
            this.homey.app.debug(`created capability ${capability} for ${this.getName()}`);
        }
    }

    /**
     * Remove a capability if it exists.
     * @private
     * @async
     * @param {string} capability - The capability to remove
     * @returns {Promise<void>}
     */
    async _removeCapabilityIfExists(capability) {
        if (this.hasCapability(capability)) {
            await this.removeCapability(capability);
            this.homey.app.debug(`removed capability ${capability} for ${this.getName()}`);
        }
    }

    /**
     * Handle temperature change from external event.
     * 
     * Called by the app when device temperature changes are detected
     * via websocket or API polling.
     * 
     * @param {number} temperature - The new temperature in degrees Celsius
     */
    onTemperatureChange(temperature) {
        if (this.hasCapability('measure_temperature')) {
            this.setCapabilityValue('measure_temperature', temperature);
        }
    }

    /**
     * Handle storage usage change from external event.
     * 
     * Called by the app when storage metrics change are detected
     * via websocket or API polling. Converts bytes to gigabytes.
     * 
     * @param {Object} storage - Storage information from API
     * @param {number} [storage.available] - Available storage space in bytes
     * @param {number} [storage.used] - Used storage space in bytes
     * @param {number} [storage.size] - Total storage size in bytes
     */
    onStorageChange(storage) {
        if (storage.hasOwnProperty('available')) {
            this._updateStorageCapability('measure_data_size.free', storage.available);
        }
        
        if (storage.hasOwnProperty('used')) {
            this._updateStorageCapability('measure_data_size.used', storage.used);
        }
        
        if (storage.hasOwnProperty('size')) {
            this._updateStorageCapability('measure_data_size.total', storage.size);
        }
    }

    /**
     * Update a storage capability value, converting bytes to gigabytes.
     * @private
     * @param {string} capability - The capability to update
     * @param {number} bytes - The storage value in bytes
     */
    _updateStorageCapability(capability, bytes) {
        if (this.hasCapability(capability)) {
            const gigabytes = bytes / BYTES_TO_GB_DIVISOR;
            this.setCapabilityValue(capability, gigabytes);
        }
    }
}

module.exports = UniFiOSDevice;
