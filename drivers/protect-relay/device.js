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

    this.onRelayUpdate(relay);
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
    const classOverride = this.getData().classOverride;
    if (classOverride === 'garagedoor') {
      return true;
    }

    if (classOverride === 'relay') {
      return false;
    }

    return String(this.getData().outputType) === 'garageDoor';
  }

  getRelayStatusSource() {
    const configured = this.getSetting('ufp:relay_status_source');
    if (configured === 'input' || configured === 'output' || configured === 'auto') {
      return configured;
    }

    return 'auto';
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

  async pulseRelay(pulseDuration) {
    const relayId = this.getRelayId();
    const outputId = this.getOutputId();
    const duration = Number(pulseDuration);
    const safeDuration = Number.isFinite(duration) && duration > 0 ? Math.round(duration) : 1000;

    if (this.homey.app.isV1Available()) {
      return this.homey.app.api.pulseRelayOutput(relayId, outputId, safeDuration);
    }

    if (this.homey.app.isV2Available()) {
      return this.homey.app.apiV2.pulseRelayOutput(relayId, outputId, safeDuration);
    }

    return Promise.reject(new Error('No API available for relay pulse control'));
  }

  onRelayUpdate(relayPayload) {
    const outputs = relayPayload && Array.isArray(relayPayload.outputs)
      ? relayPayload.outputs
      : null;

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
      const garageDoorClosed = this.resolveGarageDoorClosed(relayPayload, selectedOutput, relayOn);
      this.setCapabilityValue('garagedoor_closed', garageDoorClosed).catch(this.error);
      this.setStoreValue('lastGarageDoorClosed', garageDoorClosed).catch(this.error);
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

  onOutputsChange(outputs) {
    this.onRelayUpdate({ outputs });
  }

  resolveGarageDoorClosed(relayPayload, selectedOutput, relayOn) {
    const statusSource = this.getRelayStatusSource();

    if (statusSource !== 'output') {
      const inputClosed = this.resolveGarageDoorClosedFromInput(relayPayload, selectedOutput);
      if (typeof inputClosed === 'boolean') {
        return inputClosed;
      }

      if (statusSource === 'input') {
        const capabilityClosed = this.getCapabilityValue('garagedoor_closed');
        if (typeof capabilityClosed === 'boolean') {
          return capabilityClosed;
        }

        const storedClosed = this.getStoreValue('lastGarageDoorClosed');
        if (typeof storedClosed === 'boolean') {
          return storedClosed;
        }
      }
    }

    return !relayOn;
  }

  resolveGarageDoorClosedFromInput(relayPayload, selectedOutput) {
    if (!relayPayload || !Array.isArray(relayPayload.inputs) || relayPayload.inputs.length === 0) {
      return null;
    }

    const outputId = this.getOutputId();
    const candidateInput = relayPayload.inputs.find((input) => String(input.actionOutputId) === String(outputId))
      || relayPayload.inputs.find((input) => String(input.id) === String(outputId))
      || relayPayload.inputs[0];

    if (!candidateInput) {
      return null;
    }

    const opened = this.toBooleanState(candidateInput.state, selectedOutput);
    if (typeof opened !== 'boolean') {
      return null;
    }

    return !opened;
  }

  toBooleanState(state, selectedOutput) {
    if (typeof state === 'boolean') {
      return state;
    }

    if (typeof state === 'number') {
      return state !== 0;
    }

    if (typeof state === 'string') {
      const normalized = state.toLowerCase();
      if (normalized === 'open' || normalized === 'on' || normalized === 'active' || normalized === 'true') {
        return true;
      }

      if (normalized === 'closed' || normalized === 'off' || normalized === 'inactive' || normalized === 'false') {
        return false;
      }
    }

    if (selectedOutput && typeof selectedOutput.state === 'string') {
      return selectedOutput.state === 'on';
    }

    return null;
  }

  isRelayStatusOpen() {
    if (this.hasCapability('garagedoor_closed')) {
      const isClosed = this.getCapabilityValue('garagedoor_closed');
      if (typeof isClosed === 'boolean') {
        return !isClosed;
      }

      const storedClosed = this.getStoreValue('lastGarageDoorClosed');
      if (typeof storedClosed === 'boolean') {
        return !storedClosed;
      }
    }

    if (this.hasCapability('onoff')) {
      const onoff = this.getCapabilityValue('onoff');
      if (typeof onoff === 'boolean') {
        return onoff;
      }
    }

    const lastRelayOn = this.getStoreValue('lastRelayOn');
    return lastRelayOn === true;
  }

  isRelayStatusClosed() {
    return !this.isRelayStatusOpen();
  }
}

module.exports = Relay;


