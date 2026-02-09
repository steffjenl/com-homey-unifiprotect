'use strict';

const Homey = require('homey');

/**
 * UniFi Access Door Device Driver
 * 
 * Manages UniFi Access door devices, providing lock/unlock control,
 * door position monitoring, and access event handling.
 * 
 * @class AccessDoor
 * @extends {Homey.Device}
 */
module.exports = class AccessDoor extends Homey.Device {

    /**
     * Initialize the door device.
     * 
     * Sets up capability listeners for lock control and retrieves
     * initial door state from the API.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        this.log('Access Door has been initialized');
        this._registerCapabilityListeners();
        await this._loadInitialDoorState();
    }

    /**
     * Register capability listeners for door controls.
     * @private
     */
    _registerCapabilityListeners() {
        this.registerCapabilityListener('locked', async (value) => {
            return this._handleLockChange(value);
        });
    }

    /**
     * Handle lock state change request.
     * @private
     * @async
     * @param {boolean} value - True to lock, false to unlock
     * @returns {Promise<void>}
     */
    async _handleLockChange(value) {
        console.log('Setting Door Locked to', value);
        
        if (value) {
            this.log('Locking the door');
            return this.homey.app.accessApi.setTempDoorLockingRule(this.getData().id, 'lock_now');
        }
        
        this.log('Unlocking the door');
        return this.homey.app.accessApi.setDoorUnLock(this.getData().id);
    }

    /**
     * Load initial door state from API.
     * @private
     * @async
     * @returns {Promise<void>}
     */
    async _loadInitialDoorState() {
        try {
            const device = await this.homey.app.accessApi.getDoor(this.getData().id);
            if (device) {
                this._updateLockStatus(device);
                this._updateDoorPosition(device);
            }
        } catch (error) {
            this.error('Failed to load initial door state:', error);
        }
    }

    /**
     * Update lock status capability from device data.
     * @private
     * @param {Object} device - The device data from API
     */
    _updateLockStatus(device) {
        if (typeof device.data.door_lock_relay_status !== 'undefined') {
            const isUnlocked = device.data.door_lock_relay_status !== 'locked';
            this.setCapabilityValue('locked', isUnlocked).catch(this.error);
        }
    }

    /**
     * Update door position capability from device data.
     * @private
     * @param {Object} device - The device data from API
     */
    _updateDoorPosition(device) {
        if (typeof device.data.door_position_status !== 'undefined') {
            const isOpen = device.data.door_position_status === 'open';
            this.setCapabilityValue('alarm_contact', isOpen).catch(this.error);
        }
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
        this.log('Access Door has been added');
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
        this.log('Access Door settings where changed');
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
        this.log('Access Door was renamed');
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
        this.log('Access Door has been deleted');
    }

    /**
     * Handle lock state change from external event.
     * 
     * Called by the app when a lock state change is detected
     * via websocket or API polling.
     * 
     * @param {boolean} value - True if unlocked, false if locked
     */
    onLockChange(value) {
        this.setCapabilityValue('locked', value).catch(this.error);
    }

    /**
     * Handle door position change from external event.
     * 
     * Called by the app when a door position change is detected
     * via websocket or API polling.
     * 
     * @param {boolean} value - True if open, false if closed
     */
    onDoorChange(value) {
        this.setCapabilityValue('alarm_contact', value).catch(this.error);
    }

};
