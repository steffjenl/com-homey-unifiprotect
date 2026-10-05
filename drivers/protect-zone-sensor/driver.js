'use strict';

const Homey = require('homey');

/**
 * Virtual motion sensor per camera detection zone.
 * One device = one camera zone. alarm_motion is on while a smart detection of a chosen type is
 * open in that zone, off when Protect closes it (see SmartDetectionMixin).
 */
class ZoneSensorDriver extends Homey.Driver {

  async onInit() {
    this.homey.app.debug('[ZoneSensorDriver] initialized');
  }

  onPair(session) {
    const { homey } = this;

    session.setHandler('validate', async () => {
      const nvrip = homey.settings.get('ufp:nvrip') || homey.app.getV2Connection().host;
      return (nvrip ? 'ok' : 'nok:protect');
    });

    session.setHandler('list_devices', async () => {
      try {
        const cameras = await this._listCameras();
        const devices = [];
        for (const camera of cameras) {
          for (const zone of (camera.smartDetectZones || [])) {
            devices.push({
              name: `${camera.name} - ${zone.name || zone.id}`,
              data: { id: `${camera.id}:${zone.id}`, cameraId: String(camera.id), zoneId: String(zone.id) },
            });
          }
        }
        return devices;
      } catch (error) {
        homey.app.debug(`[ZoneSensorDriver] list_devices error: ${error}`);
        return [];
      }
    });
  }

  /**
   * Cameras + doorbells from whichever Protect API is available.
   */
  async _listCameras() {
    const app = this.homey.app;
    if (app.isV1Available()) {
      const cameras = await app.api.getCameras();
      const doorbells = await app.api.getDoorbells();
      return [...Object.values(cameras || {}), ...Object.values(doorbells || {})];
    }
    if (app.isV2Available()) {
      return Object.values(await app.apiV2.getCameras() || {});
    }
    return [];
  }

  /**
   * Called by SmartDetectionMixin while a smart detection is open (or changes).
   */
  onSmartDetectionUpdate(cameraId, eventId, types, zoneIds) {
    for (const device of this._getDevicesForCamera(cameraId)) {
      device.onZoneDetection(eventId, types, zoneIds);
    }
  }

  /**
   * Called by SmartDetectionMixin when Protect closes the detection.
   */
  onSmartDetectionEnded(cameraId, eventId) {
    for (const device of this._getDevicesForCamera(cameraId)) {
      device.onZoneDetectionEnded(eventId);
    }
  }

  _getDevicesForCamera(cameraId) {
    try {
      return this.getDevices().filter((device) => String(device.getData().cameraId) === String(cameraId));
    } catch (error) {
      return [];
    }
  }

}

module.exports = ZoneSensorDriver;
