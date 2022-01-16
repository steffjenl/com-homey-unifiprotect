'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class Sensor extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await this.waitForBootstrap();
    this.homey.app.debug('UnifiSensor Device has been initialized');
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.homey.app.debug('UnifiSensor Device has been added');
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
    this.homey.app.debug('UnifiSensor Device settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.homey.app.debug('UnifiSensor Device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.homey.app.debug('UnifiSensor Device has been deleted');
  }

  async initCamera() {
    this.registerCapabilityListener("onoff", (value) => {
      this.homey.app.api.setLightOn(this.getData(), value);
    });

    this.registerCapabilityListener("dim", (value) => {
      this.homey.app.api.setLightLevel(this.getData(), this.translateLedLevel(value, true));
    });

    this.registerCapabilityListener("light_mode", (value) => {
      this.homey.app.api.setLightMode(this.getData(), value);
    });

    await this._createMissingCapabilities();
    await this._initLightData();
  }

  async waitForBootstrap() {
    if (typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null) {
      await this.initCamera();
    } else {
      this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async _createMissingCapabilities() {
    if (this.getClass() !== 'light') {
      this.homey.app.debug(`changed class to light for ${this.getName()}`);
      this.setClass('light');
    }
    // light_mode
    if (!this.hasCapability('light_mode')) {
      this.addCapability('light_mode');
      this.homey.app.debug(`created capability light_mode for ${this.getName()}`);
    }
  }

  async _initLightData() {
    const bootstrapData = this.homey.app.api.getBootstrap();
    if (bootstrapData) {
      bootstrapData.lights.forEach((light) => {
        if (light.id === this.getData().id) {
          if (this.hasCapability('onoff')) {
            this.setCapabilityValue('onoff', light.isLightOn);
          }
          if (this.hasCapability('dim')) {
            this.setCapabilityValue('dim', this.translateLedLevel(light.lightDeviceSettings.ledLevel, false));
          }
          if (this.hasCapability('light_mode')) {
            this.setCapabilityValue('light_mode', this.translateLightMode(light.lightModeSettings));
          }
        }
      });
    }
  }

  onMotionStart() {
    this.homey.app.debug('onMotionStart');
    this.setCapabilityValue('alarm_motion', true);
  }

  onMotionEnd() {
    this.homey.app.debug('onMotionEnd');
    this.setCapabilityValue('alarm_motion', false);
  }

  onIsLightOn(isLightOn) {
    if (this.hasCapability('onoff')) {
      this.setCapabilityValue('onoff', isLightOn);
    }
  }

  onLedLevelChange(ledLevel) {
    this.homey.app.debug('onLedLevelChange');
    if (this.hasCapability('dim')) {
      this.setCapabilityValue('dim', this.translateLedLevel(ledLevel, false));
    }
  }

  onLightModeChange(settings) {
    this.homey.app.debug('onLightModeChange');
    if (this.hasCapability('light_mode')) {
      this.setCapabilityValue('light_mode', this.translateLightMode(settings));
    }
  }

  translateLightMode(settings) {
      if (settings.mode === "motion" && settings.enableAt === "fulltime") {
        return "motion";
      }
      else if (settings.mode === "motion" && settings.enableAt === "dark") {
        return "dark";
      }
      else {
        return settings.mode;
      }
  }

  translateLedLevel(ledLevel, homey) {
    if (homey) {
      if (ledLevel <= 0.16) {
        return 1;
      }
      else if(ledLevel <= 0.32) {
        return 2;
      }
      else if(ledLevel <= 0.48) {
        return 3;
      }
      else if(ledLevel <= 0.64) {
        return 4;
      }
      else if(ledLevel <= 0.80) {
        return 5;
      }
      else {
        return 6;
      }
    }
    else {
      if (ledLevel === 1) {
        return 0.16;
      }
      else if(ledLevel === 2) {
        return 0.32;
      }
      else if(ledLevel === 2) {
        return 0.48;
      }
      else if(ledLevel === 2) {
        return 0.64;
      }
      else if(ledLevel === 2) {
        return 0.80;
      }
      else {
        return 1;
      }
    }
  }

  onMotionDetected(lastMotionTime, isMotionDetected) {
    const lastMotionAt = this.getCapabilityValue('last_motion_at');

    if (!lastMotionAt) {
      this.homey.app.debug(`set last_motion_at to last datetime: ${this.getData().id}`);
      this.setCapabilityValue('last_motion_at', lastMotionTime)
          .catch(this.error);
      return;
    }

    // Check if the event date is newer
    if (isMotionDetected && lastMotionTime > lastMotionAt) {
      const lastMotion = new Date(lastMotionTime);
      this.homey.app.debug(`new motion detected on light: ${this.getData().id} on ${lastMotion.toLocaleString()}`);

      this.setCapabilityValue('last_motion_at', lastMotionTime)
          .catch(this.error);
      this.setCapabilityValue('last_motion_date', lastMotion.toLocaleDateString())
          .catch(this.error);
      this.setCapabilityValue('last_motion_time', lastMotion.toLocaleTimeString())
          .catch(this.error);
      this.onMotionStart();
    } else if (!isMotionDetected && lastMotionTime > lastMotionAt) {
      const lastMotion = new Date(lastMotionTime);
      this.homey.app.debug(`motion detected ended on light: ${this.getData().id} on ${lastMotion.toLocaleString()}`);
      this.onMotionEnd();
      this.setCapabilityValue('last_motion_at', lastMotionTime)
          .catch(this.error);
    }
  }
}

module.exports = Sensor;
