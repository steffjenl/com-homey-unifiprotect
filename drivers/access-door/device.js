'use strict';

const Homey = require('homey');

module.exports = class MyDevice extends Homey.Device {

  /**
     * onInit is called when the device is initialized.
     */
  async onInit() {
    this.log('Access Door has been initialized');
    this.registerCapabilityListener('locked', async (value) => {
      console.log('Setting Door Locked to', value);
      if (value) {
        this.log('Locking the door');
        return this.homey.app.accessApi.setTempDoorLockingRule(this.getData().id, 'lock_now');
      }
      this.log('Unlocking the door');
      return this.homey.app.accessApi.setDoorUnLock(this.getData().id);

    });
    this.homey.app.accessApi.getDoor(this.getData().id).then((device) => {
      if (device) {
        if (typeof device.data.door_lock_relay_status !== 'undefined') {
          this.setCapabilityValue('locked', device.data.door_lock_relay_status !== 'locked').catch(this.error);
        }
        if (typeof device.data.door_position_status !== 'undefined') {
          this.setCapabilityValue('alarm_contact', device.data.door_position_status === 'open').catch(this.error);
        }
      }
    });
  }

  /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
  async onAdded() {
    this.log('Access Door has been added');
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
    this.log('Access Door settings where changed');
  }

  /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
  async onRenamed(name) {
    this.log('Access Door was renamed');
  }

  /**
     * onDeleted is called when the user deleted the device.
     */
  async onDeleted() {
    this.log('Access Door has been deleted');
  }

  onLockChange(value) {
    this.setCapabilityValue('locked', value).catch(this.error);
  }

  onDoorChange(value) {
    this.setCapabilityValue('alarm_contact', value).catch(this.error);
  }

};
