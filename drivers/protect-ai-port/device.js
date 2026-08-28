'use strict';

const Homey = require('homey');
const ConnectionMonitorMixin = require('../../library/ConnectionMonitorMixin');

class AiPortDevice extends Homey.Device {
  async onInit() {
    this._startConnectionMonitoring('v2');
    this.homey.app.debug('[AiPortDevice] UniFiAiPort Device has been initialized');
    await this._initAiPortData();
  }

  async onAdded() {
    this.homey.app.debug('[AiPortDevice] UniFiAiPort Device has been added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.homey.app.debug('[AiPortDevice] UniFiAiPort Device settings where changed');
  }

  async onRenamed(name) {
    this.homey.app.debug('[AiPortDevice] UniFiAiPort Device was renamed');
  }

  async onDeleted() {
    this.homey.app.debug('[AiPortDevice] UniFiAiPort Device has been deleted');
  }

  async _initAiPortData() {
    const bootstrap = this.homey.app.api.getBootstrap();
    if (!bootstrap || !Array.isArray(bootstrap.aiports)) return;

    const aiport = bootstrap.aiports.find((a) => String(a.id) === String(this.getData().id));
    if (aiport) {
      this.onAiPortUpdate(aiport);
    }
  }

  onAiPortUpdate(payload) {
    if (typeof payload.state !== 'undefined') {
      const isConnected = payload.state === 'CONNECTED';
      this.setCapabilityValue('onoff', isConnected).catch(this.error);
    }

    if (payload.host && this.hasCapability('ip_address')) {
      this.setCapabilityValue('ip_address', payload.host).catch(this.error);
    }
  }
}

Object.assign(AiPortDevice.prototype, ConnectionMonitorMixin);

module.exports = AiPortDevice;
