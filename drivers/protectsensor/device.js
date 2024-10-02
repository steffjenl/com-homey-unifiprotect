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

  async initSensor() {
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
    await this._initSensorData();
  }

  async waitForBootstrap() {
    if (typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null) {
      await this.initSensor();
    } else {
      this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async _createMissingCapabilities() {
    if (this.getClass() !== 'sensor') {
      this.homey.app.debug(`changed class to sensor for ${this.getName()}`);
      await this.setClass('sensor');
    }
    // alarm_motion
    if (!this.hasCapability('alarm_motion')) {
      await this.addCapability('alarm_motion');
      this.homey.app.debug(`created capability alarm_motion for ${this.getName()}`);
    }
    if (!this.hasCapability('last_motion_at')) {
      await this.addCapability('last_motion_at');
      this.homey.app.debug(`created capability last_motion_at for ${this.getName()}`);
    }
    if (!this.hasCapability('measure_humidity')) {
      await this.addCapability('measure_humidity');
      this.homey.app.debug(`created capability measure_humidity for ${this.getName()}`);
    }
    if (!this.hasCapability('measure_temperature')) {
      await this.addCapability('measure_temperature');
      this.homey.app.debug(`created capability measure_temperature for ${this.getName()}`);
    }
    if (!this.hasCapability('measure_luminance')) {
      await this.addCapability('measure_luminance');
      this.homey.app.debug(`created capability measure_luminance for ${this.getName()}`);
    }
    if (!this.hasCapability('alarm_contact')) {
      await this.addCapability('alarm_contact');
      this.homey.app.debug(`created capability alarm_contact for ${this.getName()}`);
    }
    if (!this.hasCapability('last_motion_date')) {
      await this.addCapability('last_motion_date');
      this.homey.app.debug(`created capability last_motion_date for ${this.getName()}`);
    }
    if (!this.hasCapability('last_motion_time')) {
      await this.addCapability('last_motion_time');
      this.homey.app.debug(`created capability last_motion_time for ${this.getName()}`);
    }
  }

  async _initSensorData() {
    const bootstrapData = this.homey.app.api.getBootstrap();
    if (bootstrapData) {
      bootstrapData.sensors.forEach((sensor) => {
        if (sensor.id === this.getData().id) {
          if (this.hasCapability('measure_humidity')) {
            this.setCapabilityValue('measure_humidity', sensor.stats.humidity.value);
          }
          if (this.hasCapability('measure_temperature')) {
            this.setCapabilityValue('measure_temperature', sensor.stats.temperature.value);
          }
          if (this.hasCapability('measure_luminance')) {
            this.setCapabilityValue('measure_luminance', sensor.stats.light.value);
          }
          if (this.hasCapability('alarm_contact')) {
            this.setCapabilityValue('alarm_contact', sensor.isOpened);
          }
          if (this.hasCapability('alarm_motion')) {
            this.setCapabilityValue('alarm_motion', false);
          }
        }
      });
    }
  }

  refreshSensorData() {
    this.homey.app.api.getBootstrapInfo().then(() => {
      this._initSensorData();
    }).catch(error => this.homey.app.debug(error));
  }

  motion_timer_id = -1;
  motion_timer_wait_in_sec = 10;

  onMotionStart() {
    if (this.getCapabilityValue('alarm_motion') !== true) {
      this.homey.app.debug('onMotionStart');
      this.setCapabilityValue('alarm_motion', true);

      this.motion_timer_id=setTimeout(() => {
        this.onMotionEnd();
      }, this.motion_timer_wait_in_sec*1000);
    } else {
      this.homey.app.debug('onMotionStart reset timer');
      clearTimeout(this.motion_timer_id)
      this.motion_timer_id=setTimeout(() => {
        this.onMotionEnd();
      }, this.motion_timer_wait_in_sec*1000);
    }
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

  onHumidityChange(humidity) {
    this.homey.app.debug('onHumidityChange');
    if (this.hasCapability('measure_humidity')) {
      this.setCapabilityValue('measure_humidity', humidity);
    }
  }

  onTemperatureChange(temperature) {
    this.homey.app.debug('onTemperatureChange');
    if (this.hasCapability('measure_temperature')) {
      this.setCapabilityValue('measure_temperature', temperature);
    }
  }

  onLightChange(light) {
    this.homey.app.debug('onLightChange');
    if (this.hasCapability('measure_luminance')) {
      this.setCapabilityValue('measure_luminance', light);
    }
  }

  onDoorChange(isOpened) {
    this.homey.app.debug('onDoorChange');
    if (this.hasCapability('alarm_contact')) {
      this.setCapabilityValue('alarm_contact', isOpened);
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
      else if (ledLevel <= 0.32) {
        return 2;
      }
      else if (ledLevel <= 0.48) {
        return 3;
      }
      else if (ledLevel <= 0.64) {
        return 4;
      }
      else if (ledLevel <= 0.80) {
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
      else if (ledLevel === 2) {
        return 0.32;
      }
      else if (ledLevel === 2) {
        return 0.48;
      }
      else if (ledLevel === 2) {
        return 0.64;
      }
      else if (ledLevel === 2) {
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
      this.homey.app.debug(`new motion detected on sensor: ${this.getData().id} on ${lastMotion.toLocaleString()}`);

      this.setCapabilityValue('last_motion_at', lastMotionTime)
        .catch(this.error);
      this.setCapabilityValue('last_motion_date', lastMotion.toLocaleDateString())
        .catch(this.error);
      this.setCapabilityValue('last_motion_time', lastMotion.toLocaleTimeString())
        .catch(this.error);
      this.onMotionStart();
    }
  }
}

module.exports = Sensor;
