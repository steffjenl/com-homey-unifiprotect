'use strict';

const Homey = require('homey');

// Constants
const DOOR_STATUS_OPEN = 'open';

/**
 * UniFi Access Garage Door Device Driver
 * 
 * Manages UniFi Access garage door controllers, providing
 * door position sensing and remote control.
 * 
 * @class AccessGarageDoor
 * @extends {Homey.Device}
 */
class AccessGarageDoor extends Homey.Device {

    /**
     * Initialize the garage door device.
     * 
     * Called when the device is initialized. Sets up capabilities,
     * registers listeners, and loads initial door state.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        await this._migrateCapabilities();
        await this._registerCapabilityListeners();
        await this._loadInitialDoorState();
        
        this.log('Access Garagedoor has been initialized');
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
        this.log('Access Garagedoor has been added');
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
        this.log('Access Garagedoor settings where changed');
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
        this.log('Access Garagedoor was renamed');
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
        this.log('Access Garagedoor has been deleted');
    }

    /**
     * Migrate from old capability to new capability.
     * @private
     * @async
     * @returns {Promise<void>}
     */
    async _migrateCapabilities() {
        // Migrate from alarm_garagedoor_open to garagedoor_closed
        if (this.hasCapability('alarm_garagedoor_open')) {
            await this.removeCapability('alarm_garagedoor_open');
        }
        if (!this.hasCapability('garagedoor_closed')) {
            await this.addCapability('garagedoor_closed');
        }
    }

    /**
     * Register capability listeners for garage door control.
     * @private
     * @async
     * @returns {Promise<void>}
     */
    async _registerCapabilityListeners() {
        this.registerCapabilityListener('garagedoor_closed', async (value) => {
            this.log('Opening/closing the garage door');
            
            // Trigger flow card for door opened
            this.driver.ready().then(() => {
                this.driver.triggerGarageDoorOpened(this, {}, {});
            }).catch(this.error);
            
            // Send unlock command to open the door
            return this.homey.app.accessApi.setDoorUnLock(this.getData().id);
        });
    }

    /**
     * Load initial garage door state from API.
     * @private
     * @async
     * @returns {Promise<void>}
     */
    async _loadInitialDoorState() {
        const device = await this.homey.app.accessApi.getDoor(this.getData().id);
        
        if (device && typeof device.data.door_position_status !== 'undefined') {
            const isClosed = device.data.door_position_status !== DOOR_STATUS_OPEN;
            this.setCapabilityValue('garagedoor_closed', isClosed).catch(this.error);
        }
    }

    /**
     * Handle lock state change from external event.
     * 
     * Note: Currently unused but kept for future functionality.
     * 
     * @param {boolean} value - The new lock state
     */
    onLockChange(value) {
        // Reserved for future use
    }

    /**
     * Handle door position change from external event.
     * 
     * Called by the app when door position changes are detected
     * via websocket or API polling. Triggers flow cards when state changes.
     * 
     * @param {boolean} value - True if door is open, false if closed
     */
    onDoorChange(value) {
        const oldValue = this.getCapabilityValue('garagedoor_closed');
        const isClosed = !value;
        
        this.setCapabilityValue('garagedoor_closed', isClosed).catch(this.error);
        
        // Only trigger flow if state actually changed
        if (oldValue === isClosed) return;
        
        this.driver.ready().then(() => {
            if (value) {
                this.driver.triggerGarageDoorOpened(this, {}, {});
            } else {
                this.driver.triggerGarageDoorClosed(this, {}, {});
            }
        }).catch(this.error);
    }
}

module.exports = AccessGarageDoor;
