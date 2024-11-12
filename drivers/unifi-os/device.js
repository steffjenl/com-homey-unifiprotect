'use strict';

const Homey = require('homey');

module.exports = class UniFiOSDevice extends Homey.Device {

  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await this._createMissingCapabilities();
    this.log('UniFiOSDevice has been initialized');
  }

  async _createMissingCapabilities() {
    // alarm_motion
    if (!this.hasCapability('measure_data_size.free')) {
      await this.addCapability('measure_data_size.free');
      this.homey.app.debug(`created capability measure_data_size.free for ${this.getName()}`);
    }
    if (!this.hasCapability('measure_data_size.used')) {
      await this.addCapability('measure_data_size.used');
      this.homey.app.debug(`created capability measure_data_size.used for ${this.getName()}`);
    }
    if (!this.hasCapability('measure_data_size.total')) {
      await this.addCapability('measure_data_size.total');
      this.homey.app.debug(`created capability measure_data_size.total for ${this.getName()}`);
    }
    if (this.hasCapability('measure_data_size')) {
      await this.removeCapability('measure_data_size');
      this.homey.app.debug(`removed capability measure_data_size for ${this.getName()}`);
    }
    if (this.hasCapability('measure_data_rate')) {
      await this.removeCapability('measure_data_rate');
      this.homey.app.debug(`removed capability measure_data_rate for ${this.getName()}`);
    }
    if (this.hasCapability('measure_data_size.available')) {
      await this.removeCapability('measure_data_size.available');
      this.homey.app.debug(`removed capability measure_data_size.available for ${this.getName()}`);
    }
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.log('UniFiOSDevice has been added');
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
    this.log('UniFiOSDevice settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.log('UniFiOSDevice was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.log('UniFiOSDevice has been deleted');
  }

  onTemperatureChange(temperature) {
    this.homey.app.debug('onTemperatureChange');
    if (this.hasCapability('measure_temperature')) {
      this.setCapabilityValue('measure_temperature', temperature);
    }
  }

  onStorageChange(storage) {
    this.homey.app.debug('onStorageChange');
    if (storage.hasOwnProperty('available')) {
      if (this.hasCapability('measure_data_size.free')) {
        this.setCapabilityValue('measure_data_size.free', storage.available);
      }
    }
    if (storage.hasOwnProperty('used')) {
      if (this.hasCapability('measure_data_size.used')) {
        this.setCapabilityValue('measure_data_size.used', storage.used);
      }
    }
    if (storage.hasOwnProperty('size')) {
      if (this.hasCapability('measure_data_size.total')) {
        this.setCapabilityValue('measure_data_size.total', storage.size);
      }
    }
  }

};
