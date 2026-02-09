'use strict';

const Homey = require('homey');

// Constants
const ACCESS_METHOD_ENABLED = 'yes';

/**
 * UniFi Access Reader Device Driver
 * 
 * Manages UniFi Access Reader devices, which provide multiple access methods
 * including NFC, wave-to-unlock, touch-pass, mobile button, and mobile tap.
 * 
 * @class AccessReader
 * @extends {Homey.Device}
 */
class AccessReader extends Homey.Device {

    /**
     * Initialize the access reader device.
     * 
     * Called when the device is initialized. Sets up capability listeners
     * for all access methods and loads initial configuration.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        this._registerCapabilityListeners();
        await this._loadInitialAccessMethods();
        
        this.log('Access Reader has been initialized');
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
        this.log('Access Reader has been added');
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
        this.log('Access Reader settings where changed');
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
        this.log('Access Reader was renamed');
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
        this.log('Access Reader has been deleted');
    }

    /**
     * Register capability listeners for all access methods.
     * @private
     */
    _registerCapabilityListeners() {
        // NFC card/tag access
        this.registerCapabilityListener('reader_nfc_enabled', async (value) => {
            this.log('Setting NFC to', value);
            return this.homey.app.accessApi.setReaderNFC(this.getData().id, value);
        });

        // Wave-to-unlock access
        this.registerCapabilityListener('reader_wave_enabled', async (value) => {
            return this.homey.app.accessApi.setReaderWave(this.getData().id, value);
        });

        // Touch-pass access
        this.registerCapabilityListener('reader_touch-pass_enabled', async (value) => {
            return this.homey.app.accessApi.setReaderTouchPass(this.getData().id, value);
        });

        // Mobile button (Bluetooth button) access
        this.registerCapabilityListener('reader_mobile-button_enabled', async (value) => {
            return this.homey.app.accessApi.setReaderMobileButton(this.getData().id, value);
        });

        // Mobile tap (Bluetooth tap) access
        this.registerCapabilityListener('reader_mobile-tap_enabled', async (value) => {
            return this.homey.app.accessApi.setReaderMobileTap(this.getData().id, value);
        });
    }

    /**
     * Load initial access method configuration from API.
     * @private
     * @async
     * @returns {Promise<void>}
     */
    async _loadInitialAccessMethods() {
        const device = await this.homey.app.accessApi.getDevice(this.getData().id);
        
        if (!device || !device.data.access_methods) return;
        
        const methods = device.data.access_methods;
        
        this._setAccessMethodCapability('reader_nfc_enabled', methods.nfc);
        this._setAccessMethodCapability('reader_wave_enabled', methods.wave);
        this._setAccessMethodCapability('reader_touch-pass_enabled', methods.touch_pass);
        this._setAccessMethodCapability('reader_mobile-button_enabled', methods.bt_button);
        this._setAccessMethodCapability('reader_mobile-tap_enabled', methods.bt_tap);
    }

    /**
     * Set capability value for an access method if it exists in the device data.
     * @private
     * @param {string} capability - The capability name
     * @param {Object} methodData - The access method data from API
     */
    _setAccessMethodCapability(capability, methodData) {
        if (typeof methodData === 'undefined') return;
        
        if (typeof methodData.enabled !== 'undefined') {
            const isEnabled = methodData.enabled === ACCESS_METHOD_ENABLED;
            this.setCapabilityValue(capability, isEnabled).catch(this.error);
        }
    }

    /**
     * Handle touch-pass configuration change from external event.
     * 
     * Called by the app when touch-pass settings change via websocket or API polling.
     * 
     * @param {boolean} value - The new touch-pass enabled state
     */
    onTouchPassConfigChange(value) {
        this.setCapabilityValue('reader_touch-pass_enabled', value).catch(this.error);
    }

    /**
     * Handle NFC configuration change from external event.
     * 
     * Called by the app when NFC settings change via websocket or API polling.
     * 
     * @param {boolean} value - The new NFC enabled state
     */
    onNfcConfigChange(value) {
        this.setCapabilityValue('reader_nfc_enabled', value).catch(this.error);
    }

    /**
     * Handle wave configuration change from external event.
     * 
     * Called by the app when wave settings change via websocket or API polling.
     * 
     * @param {boolean} value - The new wave enabled state
     */
    onWaveConfigChange(value) {
        this.setCapabilityValue('reader_wave_enabled', value).catch(this.error);
    }

    /**
     * Handle mobile button configuration change from external event.
     * 
     * Called by the app when mobile button settings change via websocket or API polling.
     * 
     * @param {boolean} value - The new mobile button enabled state
     */
    onMobileButtonConfigChange(value) {
        this.setCapabilityValue('reader_mobile-button_enabled', value).catch(this.error);
    }

    /**
     * Handle mobile tap configuration change from external event.
     * 
     * Called by the app when mobile tap settings change via websocket or API polling.
     * 
     * @param {boolean} value - The new mobile tap enabled state
     */
    onMobileTapConfigChange(value) {
        this.setCapabilityValue('reader_mobile-tap_enabled', value).catch(this.error);
    }
}

module.exports = AccessReader;
