'use strict';

const Homey = require('homey');

class UniFiViewportDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.debug('UniFiViewport Driver has been initialized');

    const _setViewportLiveview = this.homey.flow.getActionCard('ufp_set_viewport_liveview');
    _setViewportLiveview.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined' && args.liveview_id) {
        return this.homey.app.api.setViewerLiveview(args.device.getData().id, args.liveview_id.trim());
      }
      return Promise.resolve(true);
    });
  }

  onPair(session) {
    const homey = this.homey;

    session.setHandler('validate', async function () {
      const nvrip = homey.settings.get('ufp:nvrip');
      return (nvrip ? 'ok' : 'nok');
    });

    session.setHandler('list_devices', async function () {
      const bootstrap = homey.app.api.getBootstrap();
      if (!bootstrap || !Array.isArray(bootstrap.viewers)) {
        return [];
      }

      return bootstrap.viewers.map((viewer) => ({
        data: { id: String(viewer.id) },
        name: viewer.name || viewer.displayName || 'UP Viewport',
      }));
    });
  }

  onParseWebsocketMessage(device, payload) {
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onViewerUpdate(payload);
    }
  }

  getUnifiDeviceById(deviceId) {
    try {
      const devices = this.getDevices();
      const device = devices.find((device) => String(device.getData().id) === String(deviceId));
      if (!device) return false;
      return device;
    } catch (error) {
      return false;
    }
  }
}

module.exports = UniFiViewportDriver;
