'use strict';

const Homey = require('homey');

class ViewportDevice extends Homey.Device {
  async onInit() {
    this.homey.app.debug('[ViewportDevice] UniFiViewport Device has been initialized');
    await this._initViewportData();
  }

  async onAdded() {
    this.homey.app.debug('[ViewportDevice] UniFiViewport Device has been added');
  }

  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.homey.app.debug('[ViewportDevice] UniFiViewport Device settings where changed');
  }

  async onRenamed(name) {
    this.homey.app.debug('[ViewportDevice] UniFiViewport Device was renamed');
  }

  async onDeleted() {
    this.homey.app.debug('[ViewportDevice] UniFiViewport Device has been deleted');
  }

  async _initViewportData() {
    const bootstrap = this.homey.app.api.getBootstrap();
    if (!bootstrap || !Array.isArray(bootstrap.viewers)) return;

    const viewer = bootstrap.viewers.find((v) => String(v.id) === String(this.getData().id));
    if (viewer) {
      this.onViewerUpdate(viewer);
    }
  }

  onViewerUpdate(payload) {
    if (typeof payload.state !== 'undefined') {
      const isConnected = payload.state === 'CONNECTED';
      this.setCapabilityValue('onoff', isConnected).catch(this.error);
    }
  }
}

module.exports = ViewportDevice;
