'use strict';

const Homey = require('homey');
const UfvConstants = require('../../library/constants');

class WeatherDevice extends Homey.Device {

  async onInit() {
    this.homey.app.debug('[WeatherDevice] initializing');
    await this._createMissingCapabilities();
    this._pollTimer = null;
    await this.waitForBootstrap();
  }

  async onAdded() {
    this.homey.app.debug('[WeatherDevice] added');
  }

  async onDeleted() {
    this.homey.app.debug('[WeatherDevice] deleted');
    this._stopPolling();
  }

  async onRenamed(name) {
    this.homey.app.debug('[WeatherDevice] renamed');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.homey.app.debug('[WeatherDevice] settings changed');
    if (changedKeys.includes('pollInterval')) {
      this._restartPolling(newSettings.pollInterval);
    }
  }

  async waitForBootstrap() {
    if (
      typeof this.homey.app.api.getLastUpdateId() !== 'undefined'
      && this.homey.app.api.getLastUpdateId() !== null
    ) {
      await this.initDevice();
    } else {
      this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async initDevice() {
    this.homey.app.debug('[WeatherDevice] initDevice');
    await this._pollWeather();
    const interval = this.getSetting('pollInterval') || UfvConstants.WEATHER_POLL_INTERVAL_DEFAULT;
    this._startPolling(interval);
  }

  async _createMissingCapabilities() {
    if (!this.hasCapability('measure_temperature')) {
      await this.addCapability('measure_temperature');
      this.homey.app.debug('[WeatherDevice] added measure_temperature capability');
    }
    if (!this.hasCapability('weather_condition')) {
      await this.addCapability('weather_condition');
      this.homey.app.debug('[WeatherDevice] added weather_condition capability');
    }
    if (!this.hasCapability('weather_location')) {
      await this.addCapability('weather_location');
      this.homey.app.debug('[WeatherDevice] added weather_location capability');
    }
  }

  /**
   * Translate a Weather Channel iconCode to a localised string.
   * @param {number} iconCode
   * @returns {string}
   */
  _iconCodeToText(iconCode) {
    const key = UfvConstants.WEATHER_ICON_CODES[iconCode];
    if (!key) return String(iconCode);
    const translated = this.homey.__(`weather.conditions.${key}`);
    // Fall back to the key itself if translation is missing
    return (translated && translated !== `weather.conditions.${key}`) ? translated : key;
  }

  async _pollWeather() {
    try {
      this.homey.app.debug('[WeatherDevice] polling weather');
      const data = await this.homey.app.api.getWeather();

      const { current } = data;
      const location = current.location
        ? `${current.location.city}, ${current.location.countryCode}`
        : '';
      const condition = this._iconCodeToText(current.iconCode);
      const temperature = typeof current.temperature === 'number'
        ? current.temperature
        : parseFloat(current.temperature);

      await this.setCapabilityValue('measure_temperature', temperature).catch(this.error);
      await this.setCapabilityValue('weather_condition', condition).catch(this.error);
      await this.setCapabilityValue('weather_location', location).catch(this.error);

      // Build forecast tokens
      const hourly = (data.forecast && data.forecast.hourly) ? data.forecast.hourly : [];
      const tokens = {
        temperature,
        condition,
        location,
      };

      for (let i = 1; i <= 5; i++) {
        const slot = hourly[i - 1];
        if (slot) {
          tokens[`forecast_${i}_temperature`] = typeof slot.temperature === 'number'
            ? slot.temperature
            : parseFloat(slot.temperature);
          tokens[`forecast_${i}_condition`] = this._iconCodeToText(slot.iconCode);
        } else {
          tokens[`forecast_${i}_temperature`] = null;
          tokens[`forecast_${i}_condition`] = '';
        }
      }

      // Fire flow trigger
      this.driver.homey.flow
        .getDeviceTriggerCard(UfvConstants.EVENT_WEATHER_UPDATED)
        .trigger(this, tokens)
        .catch((err) => this.error(err));

    } catch (error) {
      this.error(`[WeatherDevice] _pollWeather error: ${error.message}`);
    }
  }

  _startPolling(intervalMinutes) {
    this._stopPolling();
    const ms = intervalMinutes * 60 * 1000;
    this.homey.app.debug(`[WeatherDevice] starting poll timer every ${intervalMinutes} min`);
    this._pollTimer = this.homey.setInterval(() => {
      this._pollWeather().catch((err) => this.error(err));
    }, ms);
  }

  _stopPolling() {
    if (this._pollTimer) {
      this.homey.clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  _restartPolling(intervalMinutes) {
    this.homey.app.debug(`[WeatherDevice] restarting poll timer with interval ${intervalMinutes} min`);
    this._startPolling(intervalMinutes);
  }

}

module.exports = WeatherDevice;


