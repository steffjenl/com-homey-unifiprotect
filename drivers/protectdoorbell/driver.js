'use strict';

const Homey = require('homey');
const UfvConstants = require("../../library/constants");

class UniFiDoorbellDriver extends Homey.Driver {
  /**
   * onInit is called when the driver is initialized.
   */
  async onInit() {
    // Register flow cards
    this._connectionStatusTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_CONNECTION_CHANGED);
    this._doorbellRingingTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_DOORBELL_RINGING);
    this._smartDetectionTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION);
    this._doorbellPressetTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_PRESET);
    this._deviceSmartDetectionTrigger = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION);
    this._deviceSmartDetectionTriggerPerson = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION_PERSON);
    this._deviceSmartDetectionTriggerVehicle = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION_VEHICLE);
    this._deviceSmartDetectionTriggerAnimal = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION_ANIMAL);
    this._deviceSmartDetectionTriggerPackage = this.homey.flow.getDeviceTriggerCard(UfvConstants.EVENT_DEVICE_DOORBELL_SMART_DETECTION_PACKAGE);
    //
    this.homey.app.debug('UniFiDoorbell Driver has been initialized');
  }

  onPair(session) {
    const homey = this.homey;
    session.setHandler("validate", async function (data) {
      const nvrip = homey.settings.get('ufp:nvrip');
      return (nvrip ? 'ok' : 'nok');
    });

    session.setHandler("list_devices", async function (data) {
      return Object.values(await homey.app.api.getDoorbells()).map(camera => {
        return {
          data: {id: String(camera.id)},
          name: camera.name,
        };
      });
    });
  }

  onParseWebsocketMessage(camera, payload) {
    if (Object.prototype.hasOwnProperty.call(camera, '_events')) {
      if (payload.hasOwnProperty('isRecording')) {
        camera.onIsRecording(payload.isRecording);
      }

      if (payload.hasOwnProperty('isMicEnabled')) {
        camera.onIsMicEnabled(payload.isMicEnabled);
      }

      if (payload.hasOwnProperty('micVolume')) {
        camera.onMicVolume(payload.micVolume);
      }

      if (payload.hasOwnProperty('isConnected')) {
        camera.onIsConnected(payload.isConnected);
      }

      if (payload.hasOwnProperty('recordingSettings') && payload.recordingSettings.hasOwnProperty('mode')) {
        camera.onRecordingMode(payload.recordingSettings.mode);
      }

      if (payload.hasOwnProperty('lastMotion')) {
        camera.onMotionDetected(payload.lastMotion, payload.isMotionDetected);
      }

      if (payload.hasOwnProperty('smartDetectTypes')) {
        camera.onSmartDetection(payload.start, payload.smartDetectTypes, payload.score);
      }

      if (payload.hasOwnProperty('lastRing')) {
        camera.onDoorbellRinging(payload.lastRing);
      }

      if (payload.hasOwnProperty('isDark')) {
        camera.onIsDark(payload.isDark);
      }

      if (payload.hasOwnProperty('ispSettings') && payload.ispSettings.hasOwnProperty('irLedMode')) {
        camera.onNightVisionMode(payload.ispSettings.irLedMode);
      }

    }
  }

  getUnifiDeviceById(doorbellId) {
    try {
      const device = this.getDevice({
        id: doorbellId,
      });

      return device;
    } catch(Error) {
      return false;
    }
  }
}

module.exports = UniFiDoorbellDriver;
