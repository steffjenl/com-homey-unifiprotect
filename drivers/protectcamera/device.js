'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const https = require('https');
const SmartDetectionMixin = require('../../library/SmartDetectionMixin');

class Camera extends Homey.Device {
  /**
     * onInit is called when the device is initialized.
     */
  async onInit() {
    this.device = this;
    this.cloudUrl = null;
    this.settings = this.getSettings();
    await this.waitForBootstrap();
    this.log('UnifiCamera Device has been initialized');
  }

  /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
  async onAdded() {
    this.homey.app.debug('UnifiCamera Device has been added');
  }

  /**
     * onSettings is called when the user updates the device's settings.
     * @param {object} event the onSettings event data
     * @param {object} event.oldSettings The old settings object
     * @param {object} event.newSettings The new settings object
     * @param {string[]} event.changedKeys An array of keys changed since the previous version
     * @returns {Promise<string|void>} return a custom message that will be displayed
     */
  async onSettings({ oldSettings, newSettings, changedKeys }) {
    this.homey.app.debug('UnifiCamera Device settings where changed');
  }

  /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
  async onRenamed(name) {
    this.homey.app.debug('UnifiCamera Device was renamed');
  }

  /**
     * onDeleted is called when the user deleted the device.
     */
  async onDeleted() {
    this.homey.app.debug('UnifiCamera Device has been deleted');
  }

  async initCamera() {
    this.registerCapabilityListener('camera_microphone_volume', async (value) => {
      this.homey.app.debug('camera_microphone_volume');
      return this.homey.app.api.setMicVolume(this.getData(), value);
    });

    this.registerCapabilityListener('camera_nightvision_set', async (value) => {
      this.homey.app.debug('camera_nightvision_set');
      return this.homey.app.api.setNightVisionMode(this.getData(), value);
    });

    await this._createMissingCapabilities();
    await this._initCameraData();
    await this._createSnapshotImage();
    await this._setVideoUrl();
  }

  async waitForBootstrap() {
    if (typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null) {
      await this.initCamera();
    } else {
      this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async _createMissingCapabilities() {
    if (this.getClass() !== 'camera') {
      this.homey.app.debug(`changed class to camera for ${this.getName()}`);
      await this.setClass('camera');
    }

    // camera_nightvision_status
    if (!this.hasCapability('camera_nightvision_status')) {
      await this.addCapability('camera_nightvision_status');
      this.homey.app.debug(`created capability camera_nightvision_status for ${this.getName()}`);
    }

    if (!this.hasCapability('camera_nightvision_set')) {
      await this.addCapability('camera_nightvision_set');
      this.homey.app.debug(`created capability camera_nightvision_set for ${this.getName()}`);
    }

    if (!this.hasCapability('last_motion_score')) {
      await this.addCapability('last_motion_score');
      this.homey.app.debug(`created capability last_motion_score for ${this.getName()}`);
    }

    if (!this.hasCapability('last_motion_thumbnail')) {
      await this.addCapability('last_motion_thumbnail');
      this.homey.app.debug(`created capability last_motion_thumbnail for ${this.getName()}`);
    }
    if (!this.hasCapability('last_motion_heatmap')) {
      await this.addCapability('last_motion_heatmap');
      this.homey.app.debug(`created capability last_motion_heatmap for ${this.getName()}`);
    }
    if (this.hasCapability('last_motion_datetime')) {
      await this.removeCapability('last_motion_datetime');
      this.homey.app.debug(`removed capability last_motion_datetime for ${this.getName()}`);
    }
    if (!this.hasCapability('last_motion_date')) {
      await this.addCapability('last_motion_date');
      this.homey.app.debug(`created capability last_motion_date for ${this.getName()}`);
    }
    if (!this.hasCapability('last_motion_time')) {
      await this.addCapability('last_motion_time');
      this.homey.app.debug(`created capability last_motion_time for ${this.getName()}`);
    }
    if (!this.hasCapability('camera_recording_mode')) {
      await this.addCapability('camera_recording_mode');
      this.homey.app.debug(`created capability camera_recording_mode for ${this.getName()}`);
    }
    if (!this.hasCapability('camera_microphone_status')) {
      await this.addCapability('camera_microphone_status');
      this.homey.app.debug(`created capability camera_microphone_status for ${this.getName()}`);
    }
    if (!this.hasCapability('camera_microphone_volume')) {
      await this.addCapability('camera_microphone_volume');
      this.homey.app.debug(`created capability camera_microphone_volume for ${this.getName()}`);
    }
    if (!this.hasCapability('camera_connection_status')) {
      await this.addCapability('camera_connection_status');
      this.homey.app.debug(`created capability camera_connection_status for ${this.getName()}`);
    }
    if (this.hasCapability('last_ring_at')) {
      await this.removeCapability('last_ring_at');
      this.homey.app.debug(`removed capability last_ring_at for ${this.getName()}`);
    }
    if (!this.hasCapability('last_smart_detection_at')) {
      await this.addCapability('last_smart_detection_at');
      this.homey.app.debug(`created capability last_smart_detection_at for ${this.getName()}`);
    }
    if (!this.hasCapability('last_smart_detection_score')) {
      await this.addCapability('last_smart_detection_score');
      this.homey.app.debug(`created capability last_smart_detection_score for ${this.getName()}`);
    }
    if (!this.hasCapability('last_smart_detection_date')) {
      await this.addCapability('last_smart_detection_date');
      this.homey.app.debug(`created capability last_smart_detection_date for ${this.getName()}`);
    }
    if (!this.hasCapability('last_smart_detection_time')) {
      await this.addCapability('last_smart_detection_time');
      this.homey.app.debug(`created capability last_smart_detection_time for ${this.getName()}`);
    }
    if (!this.hasCapability('ip_address')) {
      await this.addCapability('ip_address');
      this.homey.app.debug(`created capability ip_address for ${this.getName()}`);
    }
    if (!this.hasCapability('last_nfc_card_scanned_at')) {
      await this.addCapability('last_nfc_card_scanned_at');
      this.homey.app.debug(`created capability last_nfc_card_scanned_at for ${this.getName()}`);
    }
    if (!this.hasCapability('last_fingerprint_identified_at')) {
      await this.addCapability('last_fingerprint_identified_at');
      this.homey.app.debug(`created capability last_fingerprint_identified_at for ${this.getName()}`);
    }

  }

  async _initCameraData() {
    const cameraData = this.homey.app.api.getBootstrap();

    if (cameraData) {
      cameraData.cameras.forEach((camera) => {

        if (camera.id === this.getData().id) {

          if (this.hasCapability('ip_address')) {
            this.setCapabilityValue('ip_address', camera.host).catch(this.error);
          }
          if (this.hasCapability('camera_recording_status')) {
            this.setCapabilityValue('camera_recording_status', camera.isRecording).catch(this.error);
          }
          if (this.hasCapability('camera_recording_mode')) {
            this.setCapabilityValue('camera_recording_mode',
              this.homey.__(`events.camera.${String(camera.recordingSettings.mode)
                .toLowerCase()}`)).catch(this.error);
          }
          if (this.hasCapability('camera_microphone_status')) {
            this.setCapabilityValue('camera_microphone_status', camera.isMicEnabled).catch(this.error);
          }
          if (this.hasCapability('camera_nightvision_status')) {
            this.setCapabilityValue('camera_nightvision_status', camera.isDark).catch(this.error);
          }
          if (this.hasCapability('camera_microphone_volume')) {
            this.setCapabilityValue('camera_microphone_volume', camera.micVolume).catch(this.error);
          }
          if (this.hasCapability('camera_connection_status')) {
            if (this.getCapabilityValue('camera_connection_status') !== camera.isConnected) {
              this.onConnectionChanged(camera.isConnected);
            }
            this.setCapabilityValue('camera_connection_status', camera.isConnected).catch(this.error);
          }
          if (this.hasCapability('camera_nightvision_set')) {
            this.setCapabilityValue('camera_nightvision_set', camera.ispSettings.irLedMode).catch(this.error);
          }

        }
      });
    }
  }

  onMotionStart() {
    this.homey.app.debug('onMotionStart');
    this.setCapabilityValue('alarm_motion', true).catch(this.error);
  }

  onMotionEnd() {
    this.homey.app.debug('onMotionEnd');
    this.setCapabilityValue('alarm_motion', false).catch(this.error);
  }

  onIsDark(isDark) {
    // Debug information about playload
    if (this.hasCapability('camera_nightvision_status')) {
      this.setCapabilityValue('camera_nightvision_status', isDark).catch(this.error);
    }
  }

  onNightVisionMode(mode) {
    // Debug information about playload
    if (this.hasCapability('camera_nightvision_set')) {
      this.setCapabilityValue('camera_nightvision_set', mode).catch(this.error);
    }
  }

  onMotionDetected(motionTime, isMotionDetected) {
    const lastMotionAt = this.getCapabilityValue('last_motion_at');
    const motionAt = this.homey.app.toLocalTime(new Date(motionTime));

    if (!lastMotionAt) {
      this.homey.app.debug(`set last_motion_at to last datetime: ${this.getData().id}`);
      this.setCapabilityValue('last_motion_at', motionTime)
        .catch(this.error);
      return;
    }

    // Check if the event date is newer
    if (isMotionDetected && motionTime > lastMotionAt) {
      this.homey.app.debug(`new motion detected on camera: ${this.getData().id} on ${motionAt.toLocaleString()}`);

      this.setCapabilityValue('last_motion_at', motionTime)
        .catch(this.error);
      this.setCapabilityValue('last_motion_date', motionAt.toLocaleDateString())
        .catch(this.error);
      this.setCapabilityValue('last_motion_time', motionAt.toLocaleTimeString())
        .catch(this.error);
      this.onMotionStart();
    } else if (!isMotionDetected && motionTime > lastMotionAt) {
      this.homey.app.debug(`motion detected ended on camera: ${this.getData().id} on ${motionAt.toLocaleString()}`);
      this.onMotionEnd();
      this.setCapabilityValue('last_motion_at', motionTime)
        .catch(this.error);
    }
  }

  onNFCCardScanned(payload, actionType = null, eventId = null) {
    this.homey.app.debug(`[Camera] onNFCCardScanned ${JSON.stringify(payload)}`);
    const lastNFCCardScannedAt = this.getCapabilityValue('last_nfc_card_scanned_at');
    if (typeof payload === 'undefined'
            || typeof payload.metadata === 'undefined'
            || typeof payload.metadata.nfc === 'undefined') {
      this.homey.app.debug('[Camera] NFC Card Event has no metadata');
      return false;
    }
    if (payload.start <= (lastNFCCardScannedAt + this.homey.app.ignoreEventsNfcFingerprint)) {
      this.homey.app.debug('[Camera] NFC Card Event is not newer than last event');
      return false;
    }
    this.setCapabilityValue('last_nfc_card_scanned_at', payload.start).catch(this.error);
    const ulpId = payload.metadata.nfc.ulpId || null;
    const nfcId = payload.metadata.nfc.nfcId || null;
    if (ulpId) {
      this.homey.app.api.getCloudUserById(ulpId).then((user) => {
        const email = user && user.email !== '' ? user.email : null;
        const person = user ? (email || user.username) : '';
        const firstName = user ? user.first_name : '';
        const lastName = user ? user.last_name : '';
        const uniqueId = user ? user.unique_id : ulpId;
        this.homey.app._nfcCardScannedTrigger.trigger({
          ufp_nfc_card_scanned_camera: this.getName(),
          ufp_nfc_card_scanned_person: person,
          ufp_nfc_card_scanned_first_name: firstName,
          ufp_nfc_card_scanned_last_name: lastName,
          ufp_nfc_card_scanned_user_unique_id: uniqueId,
          ufp_nfc_card_scanned_card_id: nfcId,
        }).catch(this.error);
      }).catch(this.error);
    } else {
      this.homey.app._nfcCardScannedTrigger.trigger({
        ufp_nfc_card_scanned_camera: this.getName(),
        ufp_nfc_card_scanned_person: '',
        ufp_nfc_card_scanned_first_name: '',
        ufp_nfc_card_scanned_last_name: '',
        ufp_nfc_card_scanned_user_unique_id: '',
        ufp_nfc_card_scanned_card_id: nfcId,
      }).catch(this.error);
    }
    return true;
  }

  onFingerprintIdentified(payload, actionType = null, eventId = null) {
    this.homey.app.debug(`[Camera] onFingerprintIdentified ${JSON.stringify(payload)}`);
    const lastFingerprintIdentifiedAt = this.getCapabilityValue('last_fingerprint_identified_at');
    if (typeof payload === 'undefined'
            || typeof payload.metadata === 'undefined'
            || typeof payload.metadata.fingerprint === 'undefined') {
      this.homey.app.debug('[Camera] Fingerprint Event has no metadata');
      return false;
    }
    if (payload.start <= (lastFingerprintIdentifiedAt + this.homey.app.ignoreEventsNfcFingerprint)) {
      this.homey.app.debug('[Camera] Fingerprint Event is not newer than last event');
      return false;
    }
    this.setCapabilityValue('last_fingerprint_identified_at', payload.start).catch(this.error);
    const ulpId = payload.metadata.fingerprint.ulpId || null;
    if (ulpId) {
      this.homey.app.api.getCloudUserById(ulpId).then((user) => {
        const email = user && user.email !== '' ? user.email : null;
        const person = user ? (email || user.username) : '';
        const firstName = user ? user.first_name : '';
        const lastName = user ? user.last_name : '';
        const uniqueId = user ? user.unique_id : ulpId;
        this.homey.app._fingerPrintIdentifiedTrigger.trigger({
          ufp_fingerprint_identified_camera: this.getName(),
          ufp_fingerprint_identified_person: person,
          ufp_fingerprint_identified_first_name: firstName,
          ufp_fingerprint_identified_last_name: lastName,
          ufp_fingerprint_identified_user_unique_id: uniqueId,
        }).catch(this.error);
      }).catch(this.error);
    } else {
      this.homey.app._fingerPrintIdentifiedTrigger.trigger({
        ufp_fingerprint_identified_camera: this.getName(),
        ufp_fingerprint_identified_person: '',
        ufp_fingerprint_identified_first_name: '',
        ufp_fingerprint_identified_last_name: '',
        ufp_fingerprint_identified_user_unique_id: '',
      }).catch(this.error);
    }
    return true;
  }

  onSmartDetection(payload, actionType = null, eventId = null) {
    return SmartDetectionMixin.onSmartDetection.call(this, payload, actionType, eventId);
  }

  onAudioDetection(payload, actionType = null, eventId = null) {
    return SmartDetectionMixin.onAudioDetection.call(this, payload, actionType, eventId);
  }

  mapAudioDetectionType(apiType) {
    return SmartDetectionMixin.mapAudioDetectionType.call(this, apiType);
  }

  triggerSmartDetectionTriggerUnknown(score, zones) {
    return SmartDetectionMixin.triggerSmartDetectionTriggerUnknown.call(this, score, zones);
  }

  triggerSmartDetectionTriggerPerson(score, zones) {
    return SmartDetectionMixin.triggerSmartDetectionTriggerPerson.call(this, score, zones);
  }

  triggerSmartDetectionTriggerVehicle(score, zones) {
    return SmartDetectionMixin.triggerSmartDetectionTriggerVehicle.call(this, score, zones);
  }

  triggerSmartDetectionTriggerAnimal(score, zones) {
    return SmartDetectionMixin.triggerSmartDetectionTriggerAnimal.call(this, score, zones);
  }

  triggerSmartDetectionTriggerPackage(score, zones) {
    return SmartDetectionMixin.triggerSmartDetectionTriggerPackage.call(this, score, zones);
  }

  triggerSmartDetectionTriggerLicensePlate(score, zones) {
    return SmartDetectionMixin.triggerSmartDetectionTriggerLicensePlate.call(this, score, zones);
  }

  triggerSmartDetectionTriggerFace(score, zones) {
    return SmartDetectionMixin.triggerSmartDetectionTriggerFace.call(this, score, zones);
  }

  triggerAudioDetectionTrigger(audioType, readableType, score) {
    return SmartDetectionMixin.triggerAudioDetectionTrigger.call(this, audioType, readableType, score);
  }

  _getEventStore() {
    return SmartDetectionMixin._getEventStore.call(this);
  }

  getSmartDetectionEvent(eventId) {
    return SmartDetectionMixin.getSmartDetectionEvent.call(this, eventId);
  }

  setSmartDetectionEvent(eventId, detectionTime, detectionTypes, detectionScore) {
    return SmartDetectionMixin.setSmartDetectionEvent.call(this, eventId, detectionTime, detectionTypes, detectionScore);
  }

  cleanSmartDetectionEvents() {
    return SmartDetectionMixin.cleanSmartDetectionEvents.call(this);
  }

  onConnectionChanged(connectionStatus) {
    this.homey.app._connectionStatusTrigger.trigger({
      ufp_connection_status: connectionStatus,
      ufp_connection_camera: this.getName(),
    });
  }

  onIsRecording(isRecording) {
    // Debug information about playload
    if (this.hasCapability('camera_recording_status')) {
      this.setCapabilityValue('camera_recording_status', isRecording).catch(this.error);
    }
  }

  onIsMicEnabled(isMicEnabled) {
    // Debug information about playload
    if (this.hasCapability('camera_microphone_status')) {
      this.setCapabilityValue('camera_microphone_status', isMicEnabled).catch(this.error);
    }
  }

  onIsConnected(isConnected) {
    // Debug information about playload
    if (this.getCapabilityValue('camera_connection_status') !== isConnected) {
      this.onConnectionChanged(isConnected);
    }
    this.setCapabilityValue('camera_connection_status', isConnected).catch(this.error);
  }

  onMicVolume(micVolume) {
    // Debug information about playload
    if (this.hasCapability('camera_microphone_volume')) {
      this.setCapabilityValue('camera_microphone_volume', micVolume).catch(this.error);
    }
  }

  onRecordingMode(mode) {
    // Debug information about playload
    if (this.hasCapability('camera_recording_mode')) {
      this.setCapabilityValue('camera_recording_mode',
        this.homey.__(`events.camera.${String(mode)
          .toLowerCase()}`)).catch(this.error);
    }
  }

  async _setVideoUrl() {
    this.homey.app.debug(`Getting rtsp Url for camera ${this.getName()}.`);
    try {
      this.video = await this.homey.videos.createVideoRTSP({
        allowInvalidCertificates: true,
        demuxer: 'hevc',
      });

      this.video.registerVideoUrlListener(async () => {
        return {
          url: this.rtspUrl,
        };
      });

      if (this.settings.rtspUrl && this.settings.rtspUrl !== '') {
        this.rtspUrl = this.settings.rtspUrl;
        this.homey.app.debug(`Using custom RTSP URL for camera ${this.getName()}: ${this.rtspUrl}`);
        return;
      }

      await this.homey.app.api.getStreamUrl(this.getData()).then(((rtspUrl) => {
        this.log(`RTSP URL for camera ${this.getName()}: ${rtspUrl}`);
        this.rtspUrl = rtspUrl;
      })).catch(this.error);

      this.setCameraVideo('snapshot', `${this.getName()} Video`, this.video);
    } catch (err) {
      this.error('Error creating camera:', err);
    }
  }

  async _createSnapshotImage(triggerFlow = false) {
    this.homey.app.debug(`Creating snapshot image for camera ${this.getName()}.`);

    this._snapshotImage = await this.homey.images.createImage();
    const ipAddress = this.getCapabilityValue('ip_address');

    this._snapshotImage.setStream(async (stream) => {
      // Obtain snapshot URL
      let snapshotUrl = null;

      if (this.homey.app.useCameraSnapshot) {
        snapshotUrl = `https://${ipAddress}/snap.jpeg`;
      } else {
        await this.homey.app.api.createSnapshotUrl(this.getData())
          .then((url) => {
            snapshotUrl = url;
          })
          .catch(this.error.bind(this, 'Could not create snapshot URL.'));
      }

      if (!snapshotUrl) {
        throw new Error('Invalid snapshot url.');
      }

      const headers = {};
      headers['Cookie'] = this.homey.app.api.getProxyCookieToken();

      const agent = new https.Agent({
        rejectUnauthorized: false,
        keepAlive: false,
      });

      // Fetch image
      const res = await fetch(snapshotUrl, {
        agent,
        headers,
      });
      if (!res.ok) throw new Error('Could not fetch snapshot image.');

      return res.body.pipe(stream);
    });

    if (triggerFlow) {
      this.homey.app.api.getStreamUrl(this.getData()).then(((rtspUrl) => {
        this.homey.app.triggerSnapshotTrigger({
          ufv_snapshot_token: this._snapshotImage,
          ufv_snapshot_camera: this.getName(),
          ufv_snapshot_snapshot_url: '',
          ufv_snapshot_stream_url: rtspUrl,
        });
      })).catch(this.log);
    }

    this.cloudUrl = this._snapshotImage.cloudUrl;

    this.setCameraImage('snapshot', this.getName(), this._snapshotImage).catch(this.error);
    this.homey.app.debug(`Created snapshot image for camera ${this.getName()}.`);
  }

}

module.exports = Camera;
