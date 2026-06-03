'use strict';

const Homey = require('homey');

class ProtectHornSpeakerDevice extends Homey.Device {
  async onInit() {
    await this.waitForBootstrap();
    this.homey.app.debug('[ProtectHornSpeakerDevice] initialized');
  }

  async onAdded() {
    this.homey.app.debug('[ProtectHornSpeakerDevice] added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.homey.app.debug('[ProtectHornSpeakerDevice] settings changed');
  }

  async onRenamed(name) {
    this.homey.app.debug('[ProtectHornSpeakerDevice] renamed');
  }

  async onDeleted() {
    this.homey.app.debug('[ProtectHornSpeakerDevice] deleted');
  }

  async waitForBootstrap() {
    const v1Ready = typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null;
    const v2Ready = this.homey.app.isV2Available();

    if (v1Ready || v2Ready) {
      await this.initDevice();
    } else {
      this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async initDevice() {
    await this._createMissingCapabilities();
    await this._initDeviceData();

    this.registerCapabilityListener('onoff', async (value) => {
      if (value === false) {
        return this.homey.app.api.setSpeakerVolume(this.getData(), 0);
      }

      const currentVolume = this.getCapabilityValue('volume_set');
      const nextVolume = (typeof currentVolume === 'number' && currentVolume > 0) ? currentVolume : 0.5;
      return this.homey.app.api.setSpeakerVolume(this.getData(), nextVolume);
    });

    this.registerCapabilityListener('volume_set', async (value) => {
      return this.homey.app.api.setSpeakerVolume(this.getData(), value);
    });
  }

  async _createMissingCapabilities() {
    if (!this.hasCapability('onoff')) {
      await this.addCapability('onoff');
    }

    if (!this.hasCapability('volume_set')) {
      await this.addCapability('volume_set');
    }

    if (this.getClass() !== 'speaker') {
      this.homey.app.debug(`changed class to speaker for ${this.getName()}`);
      await this.setClass('speaker');
    }
  }

  async _initDeviceData() {
    try {
      const bootstrap = this.homey.app.api.getBootstrap();
      if (!bootstrap || !Array.isArray(bootstrap.speakers)) {
        return;
      }

      const speaker = bootstrap.speakers.find((item) => String(item.id) === String(this.getData().id));
      if (!speaker) {
        return;
      }

      await this.onSpeakerUpdate(speaker);
    } catch (error) {
      this.error(error);
    }
  }

  async onSpeakerUpdate(payload) {
    try {
      if (!payload || typeof payload.volume === 'undefined') {
        return;
      }

      const normalized = Math.max(0, Math.min(100, Number(payload.volume))) / 100;
      if (this.hasCapability('volume_set')) {
        await this.setCapabilityValue('volume_set', normalized);
      }

      if (this.hasCapability('onoff')) {
        await this.setCapabilityValue('onoff', normalized > 0);
      }
    } catch (error) {
      this.error(error);
    }
  }
}

module.exports = ProtectHornSpeakerDevice;

