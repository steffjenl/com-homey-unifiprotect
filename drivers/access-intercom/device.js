'use strict';

const Homey = require('homey');

class IntercomDevice extends Homey.Device {
  async onInit() {
    this.log('Access Intercom Device has been initialized');

    this.registerCapabilityListener('locked', async (value) => {
      if (value) {
        return this.homey.app.accessApi.setTempDoorLockingRule(
          this.getData().doorId || this.getData().id,
          'lock_now',
        );
      }
      return this.homey.app.accessApi.setDoorUnLock(this.getData().doorId || this.getData().id);
    });
  }

  async onAdded() {
    this.log('Access Intercom Device has been added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.log('Access Intercom Device settings where changed');
  }

  async onRenamed(name) {
    this.log('Access Intercom Device was renamed');
  }

  async onDeleted() {
    this.log('Access Intercom Device has been deleted');
  }

  onLockChange(value) {
    this.setCapabilityValue('locked', value).catch(this.error);
  }

  onDoorChange(value) {
    this.setCapabilityValue('alarm_contact', value).catch(this.error);
  }

  onBellPressed() {
    this.driver.triggerBellPressed(this);
  }
}

module.exports = IntercomDevice;
