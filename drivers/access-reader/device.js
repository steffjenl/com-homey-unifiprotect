'use strict';

const Homey = require('homey');

module.exports = class Reader extends Homey.Device {

  /**
     * onInit is called when the device is initialized.
     */
  async onInit() {
    this.log('Access Reader has been initialized');
    this.registerCapabilityListener('reader_nfc_enabled', async (value) => {
      console.log('Setting NFC to', value);
      return this.homey.app.accessApi.setReaderNFC(this.getData().id, value);
    });
    this.registerCapabilityListener('reader_wave_enabled', async (value) => {
      return this.homey.app.accessApi.setReaderWave(this.getData().id, value);
    });
    this.registerCapabilityListener('reader_touch-pass_enabled', async (value) => {
      return this.homey.app.accessApi.setReaderTouchPass(this.getData().id, value);
    });
    this.registerCapabilityListener('reader_mobile-button_enabled', async (value) => {
      return this.homey.app.accessApi.setReaderMobileButton(this.getData().id, value);
    });
    this.registerCapabilityListener('reader_mobile-tap_enabled', async (value) => {
      return this.homey.app.accessApi.setReaderMobileTap(this.getData().id, value);
    });
    //
    this.homey.app.accessApi.getDevice(this.getData().id).then((device) => {
      if (device) {
        if (typeof device.data.access_methods !== 'undefined') {
          if (typeof device.data.access_methods.nfc !== 'undefined') {
            this.setCapabilityValue('reader_nfc_enabled', device.data.access_methods.nfc.enabled === 'yes').catch(this.error);
          }
          if (typeof device.data.access_methods.wave !== 'undefined') {
            this.setCapabilityValue('reader_wave_enabled', device.data.access_methods.wave.enabled === 'yes').catch(this.error);
          }
          if (typeof device.data.access_methods.touch_pass !== 'undefined') {
            this.setCapabilityValue('reader_touch-pass_enabled', device.data.access_methods.touch_pass.enabled === 'yes').catch(this.error);
          }
          if (typeof device.data.access_methods.bt_button !== 'undefined') {
            this.setCapabilityValue('reader_mobile-button_enabled', device.data.access_methods.bt_button.enabled === 'yes').catch(this.error);
          }
          if (typeof device.data.access_methods.bt_tap !== 'undefined') {
            this.setCapabilityValue('reader_mobile-tap_enabled', device.data.access_methods.bt_tap.enabled === 'yes').catch(this.error);
          }
        }
      }
    });
  }

  /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
  async onAdded() {
    this.log('Access Reader has been added');
  }

  /**
     * onSettings is called when the user updates the device's settings.
     * @param {object} event the onSettings event data
     * @param {object} event.oldSettings The old settings object
     * @param {object} event.newSettings The new settings object
     * @param {string[]} event.changedKeys An array of keys changed since the previous version
     * @returns {Promise<string|void>} return a custom message that will be displayed
     */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Access Reader settings where changed');
  }

  /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
  async onRenamed(name) {
    this.log('Access Reader was renamed');
  }

  /**
     * onDeleted is called when the user deleted the device.
     */
  async onDeleted() {
    this.log('Access Reader has been deleted');
  }

  onTouchPassConfigChange(value) {
    this.setCapabilityValue('reader_touch-pass_enabled', value).catch(this.error);
  }

  onNfcConfigChange(value) {
    this.setCapabilityValue('reader_nfc_enabled', value).catch(this.error);
  }

  onWaveConfigChange(value) {
    this.setCapabilityValue('reader_wave_enabled', value).catch(this.error);
  }

  onMobileButtonConfigChange(value) {
    this.setCapabilityValue('reader_mobile-button_enabled', value);
  }

  onMobileTapConfigChange(value) {
    this.setCapabilityValue('reader_mobile-tap_enabled', value);
  }

};
