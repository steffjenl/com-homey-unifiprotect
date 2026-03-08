'use strict';

const Homey = require('homey');

module.exports = class MyDevice extends Homey.Device {

  /**
     * onInit is called when the device is initialized.
     */
  async onInit() {
    if (this.hasCapability('alarm_garagedoor_open')) {
      await this.removeCapability('alarm_garagedoor_open');
    }
    if (!this.hasCapability('garagedoor_closed')) {
      await this.addCapability('garagedoor_closed');
    }
    //
    this.log('Access Garagedoor has been initialized');
    this.registerCapabilityListener('garagedoor_closed', async (value) => {
      this.log('Unlocking the door');
      this.driver.ready().then(() => {
        this.driver.triggerGarageDoorOpened(this, {}, {});
      }).catch(this.error);
      return this.homey.app.accessApi.setDoorUnLock(this.getData().id);
    });
    this.homey.app.accessApi.getDoor(this.getData().id).then((device) => {
      if (device) {
        if (typeof device.data.door_position_status !== 'undefined') {
          this.setCapabilityValue('garagedoor_closed', device.data.door_position_status !== 'open').catch(this.error);
        }
      }
    });
  }

  /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
  async onAdded() {
    this.log('Access Garagedoor has been added');
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
    this.log('Access Garagedoor settings where changed');
  }

  /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
  async onRenamed(name) {
    this.log('Access Garagedoor was renamed');
  }

  /**
     * onDeleted is called when the user deleted the device.
     */
  async onDeleted() {
    this.log('Access Garagedoor has been deleted');
  }

  onLockChange(value) {
    // this.setCapabilityValue('garagedoor_closed', value);
  }

  onDoorChange(value) {
    const oldValue = this.getCapabilityValue('garagedoor_closed');
    this.setCapabilityValue('garagedoor_closed', !value).catch(this.error);
    if (oldValue !== value) return;
    if (value) {
      this.driver.ready().then(() => {
        this.driver.triggerGarageDoorOpened(this, {}, {});
      }).catch(this.error);
    } else {
      this.driver.ready().then(() => {
        this.driver.triggerGarageDoorClosed(this, {}, {});
      }).catch(this.error);
    }
  }

};
