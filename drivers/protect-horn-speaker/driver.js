'use strict';

const Homey = require('homey');

class ProtectHornSpeakerDriver extends Homey.Driver {
  async onInit() {
    this.homey.app.debug('[ProtectHornSpeakerDriver] initialized');
  }

  onPair(session) {
    const { homey } = this;

    session.setHandler('validate', async () => {
      const nvrip = homey.settings.get('ufp:nvrip');
      return (nvrip ? 'ok' : 'nok');
    });

    session.setHandler('list_devices', async () => {
      try {
        const bootstrap = homey.app.api.getBootstrap();
        if (bootstrap && Array.isArray(bootstrap.speakers)) {
          return bootstrap.speakers
            .filter((speaker) => speaker && speaker.id)
            .map((speaker) => ({
              data: { id: String(speaker.id) },
              name: speaker.name || speaker.displayName || speaker.mac || `Speaker ${String(speaker.id).slice(-6)}`,
            }));
        }

        if (!homey.app.isV1Available()) {
          homey.app.debug('[ProtectHornSpeakerDriver] V1 API unavailable, cannot list speakers');
          return [];
        }

        const speakers = await homey.app.api.getSpeakers();
        return Object.values(speakers)
          .filter((speaker) => speaker && speaker.id)
          .map((speaker) => ({
            data: { id: String(speaker.id) },
            name: speaker.name || speaker.displayName || speaker.mac || `Speaker ${String(speaker.id).slice(-6)}`,
          }));
      } catch (error) {
        homey.app.debug('[ProtectHornSpeakerDriver] Failed to list speakers: ' + error);
        return [];
      }
    });
  }

  onParseWebsocketMessage(device, payload) {
    if (Object.prototype.hasOwnProperty.call(device, '_events')) {
      device.onSpeakerUpdate(payload);
    }
  }

  getUnifiDeviceById(deviceId) {
    try {
      const devices = this.getDevices();
      const device = devices.find((item) => String(item.getData().id) === String(deviceId));
      return device || false;
    } catch (error) {
      return false;
    }
  }
}

module.exports = ProtectHornSpeakerDriver;

