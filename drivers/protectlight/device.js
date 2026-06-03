'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class Light extends Homey.Device {
  /**
   * onInit is called when the device is initialized.
   */
  async onInit() {
    await this.waitForBootstrap();
    this.homey.app.debug('UnifiLight Device has been initialized');
  }

  /**
   * onAdded is called when the user adds the device, called just after pairing.
   */
  async onAdded() {
    this.homey.app.debug('UnifiLight Device has been added');
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
    this.homey.app.debug('UnifiLight Device settings where changed');
  }

  /**
   * onRenamed is called when the user updates the device's name.
   * This method can be used this to synchronise the name to the device.
   * @param {string} name The new name
   */
  async onRenamed(name) {
    this.homey.app.debug('UnifiLight Device was renamed');
  }

  /**
   * onDeleted is called when the user deleted the device.
   */
  async onDeleted() {
    this.homey.app.debug('UnifiLight Device has been deleted');
  }

  async initLight() {
    this.registerCapabilityListener("onoff", (value) => {
      if (this.homey.app.isV1Available()) {
        return this.homey.app.api.setLightOn(this.getData(), value);
      } else if (this.homey.app.isV2Available()) {
        return this.homey.app.apiV2.setLight(this.getData().id, { isLightForceEnabled: value });
      }
    });

    this.registerCapabilityListener("dim", (value) => {
      if (this.homey.app.isV1Available()) {
        return this.homey.app.api.setLightLevel(this.getData(), this.translateLedLevel(value, true));
      } else if (this.homey.app.isV2Available()) {
        return this.homey.app.apiV2.setLight(this.getData().id, {
          lightDeviceSettings: { ledLevel: this.translateLedLevel(value, true) }
        });
      }
    });

    this.registerCapabilityListener("light_mode_unifi", (value) => {
      if (this.homey.app.isV1Available()) {
        return this.homey.app.api.setLightMode(this.getData(), value);
      } else if (this.homey.app.isV2Available()) {
        let lightModeSettings = {};
        if (value === "motion") {
          lightModeSettings = { mode: "motion", enableAt: "fulltime" };
        } else if (value === "dark") {
          lightModeSettings = { mode: "motion", enableAt: "dark" };
        } else {
          lightModeSettings = { mode: value, enableAt: "dark" };
        }
        return this.homey.app.apiV2.setLight(this.getData().id, { lightModeSettings });
      }
    });

    await this._createMissingCapabilities();
    await this._initLightData();
  }

  async waitForBootstrap() {
    const v1Ready = typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null;
    const v2Ready = this.homey.app.isV2Available();

    if (v1Ready || v2Ready) {
      await this.initLight();
    } else {
      this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async _createMissingCapabilities() {
    if (this.getClass() !== 'light') {
      this.homey.app.debug(`changed class to light for ${this.getName()}`);
      await this.setClass('light');
    }
    // light_mode_unifi
    if (!this.hasCapability('light_mode_unifi')) {
      await this.addCapability('light_mode_unifi');
      this.homey.app.debug(`created capability light_mode_unifi for ${this.getName()}`);
    }
  }

  async _initLightData() {
    let light = null;

    // Try V1 bootstrap first
    if (this.homey.app.isV1Available()) {
      const bootstrapData = this.homey.app.api.getBootstrap();
      if (bootstrapData && bootstrapData.lights) {
        light = bootstrapData.lights.find(l => l.id === this.getData().id);
      }
    }

    // Fall back to V2 API
    if (!light && this.homey.app.isV2Available()) {
      try {
        light = await this.homey.app.apiV2.getLight(this.getData().id);
      } catch (e) {
        this.homey.app.debug(`V2 getLight failed for ${this.getData().id}: ${e}`);
      }
    }

    if (light) {
      if (this.hasCapability('onoff')) {
        this.setCapabilityValue('onoff', light.isLightOn);
      }
      if (this.hasCapability('dim') && light.lightDeviceSettings) {
        this.setCapabilityValue('dim', this.translateLedLevel(light.lightDeviceSettings.ledLevel, false));
      }
      if (this.hasCapability('light_mode_unifi') && light.lightModeSettings) {
        this.setCapabilityValue('light_mode_unifi', this.translateLightMode(light.lightModeSettings));
      }
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
    if (this.hasCapability('light_mode_unifi')) {
      this.setCapabilityValue('light_mode_unifi', this.translateLightMode(settings));
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
      else if(ledLevel === 3) {
        return 0.48;
      }
      else if(ledLevel === 4) {
        return 0.64;
      }
      else if(ledLevel === 5) {
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
      const lastMotion = this.homey.app.toLocalTime(new Date(lastMotionTime));
      this.homey.app.debug(`new motion detected on light: ${this.getData().id} on ${lastMotion.toLocaleString()}`);

      this.setCapabilityValue('last_motion_at', lastMotionTime)
          .catch(this.error);
      this.setCapabilityValue('last_motion_date', lastMotion.toLocaleDateString())
          .catch(this.error);
      this.setCapabilityValue('last_motion_time', lastMotion.toLocaleTimeString())
          .catch(this.error);
      this.onMotionStart();
    } else if (!isMotionDetected && lastMotionTime > lastMotionAt) {
      const lastMotion = this.homey.app.toLocalTime(new Date(lastMotionTime));
      this.homey.app.debug(`motion detected ended on light: ${this.getData().id} on ${lastMotion.toLocaleString()}`);
      this.onMotionEnd();
      this.setCapabilityValue('last_motion_at', lastMotionTime)
          .catch(this.error);
    }
  }
}

module.exports = Light;
