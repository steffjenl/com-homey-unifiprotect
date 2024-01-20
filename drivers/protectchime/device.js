'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class Chime extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await this.waitForBootstrap();
    this.homey.app.debug('UnifiChime Device has been initialized');
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.homey.app.debug('UnifiChime Device has been added');
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
    this.homey.app.debug('UnifiChime Device settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.homey.app.debug('UnifiChime Device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.homey.app.debug('UnifiChime Device has been deleted');
  }

  async initChime() {
    this.registerCapabilityListener("onoff", (value) => {
      this.homey.app.api.setVolume(this.getData(), (value === true ? 100 : 0));
    });

    this.registerCapabilityListener("volume_set", (value) => {
      this.homey.app.api.setVolume(this.getData(), value);
    });

    await this._createMissingCapabilities();
    await this._initChimeData();
  }

  async waitForBootstrap() {
    if (typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null) {
      await this.initChime();
    } else {
      this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async _createMissingCapabilities() {
    if (this.getClass() !== 'sensor') {
      this.homey.app.debug(`changed class to sensor for ${this.getName()}`);
      await this.setClass('sensor');
    }
  }

  async _initChimeData() {
    const bootstrapData = this.homey.app.api.getBootstrap();
    if (bootstrapData) {
      bootstrapData.chimes.forEach((chime) => {
        if (chime.id === this.getData().id) {
          if (this.hasCapability('onoff')) {
            this.setCapabilityValue('onoff', (chime.volume > 0));
          }
          if (this.hasCapability('volume_set')) {
            this.setCapabilityValue('volume_set', chime.volume);
          }
        }
      });
    }
  }

  onIsChimeOn(volume) {
    if (this.hasCapability('onoff')) {
      this.setCapabilityValue('onoff', (volume > 0));
    }
    if (this.hasCapability('volume_set')) {
      this.setCapabilityValue('volume_set', volume);
    }
  }
}

module.exports = Chime;
