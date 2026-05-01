'use strict';

const Homey = require('homey');

class Relay extends Homey.Device {
  async onInit() {
    await this.waitForBootstrap();
    this.homey.app.debug('[RelayDevice] UniFiRelay Device has been initialized');
  }

  async onAdded() {
    this.homey.app.debug('[RelayDevice] UniFiRelay Device has been added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.homey.app.debug('[RelayDevice] UniFiRelay Device settings where changed');
  }

  async onRenamed(name) {
    this.homey.app.debug('[RelayDevice] UniFiRelay Device was renamed');
  }

  async onDeleted() {
    this.homey.app.debug('[RelayDevice] UniFiRelay Device has been deleted');
  }

  async initRelay() {
    await this._createMissingCapabilities();

    if (this.hasCapability('onoff')) {
      this.registerCapabilityListener('onoff', (value) => this.setRelayState(value));
    }

    if (this.hasCapability('garagedoor_closed')) {
      this.registerCapabilityListener('garagedoor_closed', (value) => this.setRelayState(!value));
    }

    await this._initRelayData();
  }

  async waitForBootstrap() {
    const v1Ready = typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null;
    const v2Ready = this.homey.app.isV2Available();

    if (v1Ready || v2Ready) {
      await this.initRelay();
    } else {
      this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async _createMissingCapabilities() {
    const garageRelay = this.isGarageDoorOutput();

    if (garageRelay) {
      if (this.getClass() !== 'garagedoor') {
        this.homey.app.debug('[RelayDevice] changed class to garagedoor for ' + this.getName());
        await this.setClass('garagedoor');
      }

      if (!this.hasCapability('garagedoor_closed')) {
        await this.addCapability('garagedoor_closed');
      }

      if (this.hasCapability('onoff')) {
        await this.removeCapability('onoff');
      }
    } else {
      if (this.getClass() !== 'socket') {
        this.homey.app.debug('[RelayDevice] changed class to socket for ' + this.getName());
        await this.setClass('socket');
      }

      if (!this.hasCapability('onoff')) {
        await this.addCapability('onoff');
      }

      if (this.hasCapability('garagedoor_closed')) {
        await this.removeCapability('garagedoor_closed');
      }
    }
  }

  async _initRelayData() {
    let relay = null;

    if (this.homey.app.isV1Available()) {
      const bootstrapData = this.homey.app.api.getBootstrap();
      if (bootstrapData && Array.isArray(bootstrapData.relays)) {
        relay = bootstrapData.relays.find((item) => String(item.id) === String(this.getRelayId()));
      }
    }

    if (!relay && this.homey.app.isV2Available()) {
      relay = await this.homey.app.apiV2.getRelay(this.getRelayId()).catch(this.error);
    }

    if (!relay || !Array.isArray(relay.outputs)) {
      return;
    }

    this.onOutputsChange(relay.outputs);
  }

  getOutputId() {
    const outputId = this.getData().outputId;
    if (typeof outputId === 'number' && !Number.isNaN(outputId)) {
      return outputId;
    }
    return 0;
  }

  getRelayId() {
    if (typeof this.getData().relayId !== 'undefined') {
      return this.getData().relayId;
    }

    return this.getData().id;
  }

  isGarageDoorOutput() {
    return String(this.getData().outputType) === 'garageDoor';
  }

  async setRelayState(isOn) {
    const relayId = this.getRelayId();
    const outputId = this.getOutputId();

    if (this.homey.app.isV1Available()) {
      return this.homey.app.api.setRelayOutputState(relayId, outputId, isOn);
    }

    if (this.homey.app.isV2Available()) {
      return this.homey.app.apiV2.setRelayOutputState(relayId, outputId, isOn);
    }

    return Promise.reject(new Error('No API available for relay control'));
  }

  onOutputsChange(outputs) {
    if (!Array.isArray(outputs)) {
      return;
    }

    const selectedOutput = outputs.find((output) => String(output.id) === String(this.getOutputId())) || outputs[0];
    if (!selectedOutput) {
      return;
    }

    const relayOn = selectedOutput.state === 'on';
    const previousRelayOn = this.getStoreValue('lastRelayOn');

    if (this.hasCapability('onoff')) {
      this.setCapabilityValue('onoff', relayOn).catch(this.error);
    }

    if (this.hasCapability('garagedoor_closed')) {
      this.setCapabilityValue('garagedoor_closed', !relayOn).catch(this.error);
    }

    if (typeof previousRelayOn === 'boolean' && previousRelayOn !== relayOn) {
      this.driver.triggerRelayStateChanged(this, relayOn ? 'on' : 'off');
      if (relayOn) {
        this.driver.triggerRelayTurnedOn(this);
      } else {
        this.driver.triggerRelayTurnedOff(this);
      }
    }

    this.setStoreValue('lastRelayOn', relayOn).catch(this.error);
  }
}

module.exports = Relay;



