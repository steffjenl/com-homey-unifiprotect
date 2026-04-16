'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const https = require('https');
const SmartDetectionMixin = require('../../library/SmartDetectionMixin');

class Doorbell extends Homey.Device {
  /**
     * onInit is called when the device is initialized.
     */
  async onInit() {
    this.device = this;
    this.cloudUrl = null;
    this.cloudUrlPackage = null;
    this.rtspUrl = null;
    this.rtspPackageUrl = null;
    this.settings = this.getSettings();
    await this.waitForBootstrap();
    this.cleanSmartDetectionEvents();
    this.homey.app.debug('UnifiDoorbell Device has been initialized');
  }

  /**
     * onAdded is called when the user adds the device, called just after pairing.
     */
  async onAdded() {
    this.homey.app.debug('UnifiDoorbell Device has been added');
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
    if (newSettings.rtspUrl && newSettings.rtspUrl !== '') {
      this.rtspUrl = newSettings.rtspUrl;
      this.log(`Using custom RTSP URL for doorbell ${this.getName()}: ${this.rtspUrl}`);
      this.setCameraVideo('snapshot', `${this.getName()} Video`, this.video);
      return;
    }
    if (newSettings.rtspPackageUrl && newSettings.rtspPackageUrl !== '') {
      this.rtspPackageUrl = newSettings.rtspPackageUrl;
      this.log(`Using custom RTSP URL for doorbell ${this.getName()}: ${this.rtspPackageUrl}`);
      this.setCameraVideo('package-snapshot', `${this.getName()} Package Video`, this.packageVideo);
      return;
    }
    this.homey.app.debug('UnifiDoorbell Device settings where changed');
  }

  /**
     * onRenamed is called when the user updates the device's name.
     * This method can be used this to synchronise the name to the device.
     * @param {string} name The new name
     */
  async onRenamed(name) {
    this.homey.app.debug('UnifiDoorbell Device was renamed');
  }

  /**
     * onDeleted is called when the user deleted the device.
     */
  async onDeleted() {
    this.homey.app.debug('UnifiDoorbell Device has been deleted');
  }

  async initDoorbell() {
    this.registerCapabilityListener('camera_microphone_volume', async (value) => {
      this.homey.app.debug('camera_microphone_volume');
      if (this.homey.app.isV1Available()) {
        return this.homey.app.api.setMicVolume(this.getData(), value);
      } else if (this.homey.app.isV2Available()) {
        return this.homey.app.apiV2.setCamera(this.getData().id, { micVolume: value });
      }
    });

    this.registerCapabilityListener('doorbell_ring_volume', async (value) => {
      this.homey.app.debug(`[DoorbellDevice] doorbell_ring_volume: ${value}`);
      if (this.homey.app.isV1Available()) {
        return this.homey.app.api.setDoorbellRingVolume(this.getData(), value);
      }
      // V2 does not expose speakerSettings directly
    });

    this.registerCapabilityListener('doorbell_speaker_volume', async (value) => {
      this.homey.app.debug(`[DoorbellDevice] doorbell_speaker_volume: ${value}`);
      if (this.homey.app.isV1Available()) {
        return this.homey.app.api.setDoorbellTalkbackVolume(this.getData(), value);
      }
      // V2 does not expose speakerSettings directly
    });

    this.registerCapabilityListener('camera_nightvision_set', async (value) => {
      this.homey.app.debug('camera_nightvision_set');
      if (this.homey.app.isV1Available()) {
        return this.homey.app.api.setNightVisionMode(this.getData(), value);
      }
      // V2 does not expose irLedMode directly
    });

    await this._createMissingCapabilities();
    await this._createSnapshotImage();
    await this._setVideoUrl();
    await this._initDoorbellData();
  }

  async waitForBootstrap() {
    const v1Ready = typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null;
    const v2Ready = this.homey.app.isV2Available();

    if (v1Ready || v2Ready) {
      await this.initDoorbell();
    } else {
      this.homey.setTimeout(this.waitForBootstrap.bind(this), 250);
    }
  }

  async _createMissingCapabilities() {
    if (this.getClass() !== 'doorbell') {
      this.homey.app.debug(`changed class to doorbell for ${this.getName()}`);
      await this.setClass('doorbell');
    }

    // Doorbell_nightvision_status
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
    if (!this.hasCapability('last_ring_at')) {
      await this.addCapability('last_ring_at');
      this.homey.app.debug(`created capability last_ring_at for ${this.getName()}`);
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
    if (!this.hasCapability('last_fingerprint_identified_at')) {
      await this.addCapability('last_fingerprint_identified_at');
      this.homey.app.debug(`created capability last_fingerprint_identified_at for ${this.getName()}`);
    }
    if (!this.hasCapability('last_nfc_card_scanned_at')) {
      await this.addCapability('last_nfc_card_scanned_at');
      this.homey.app.debug(`created capability last_nfc_card_scanned_at for ${this.getName()}`);
    }
    if (!this.hasCapability('doorbell_ring_volume')) {
      await this.addCapability('doorbell_ring_volume');
      this.homey.app.debug(`created capability doorbell_ring_volume for ${this.getName()}`);
    }
    if (this.hasCapability('volume_set')) {
      await this.removeCapability('volume_set');
      this.homey.app.debug(`removed legacy capability volume_set for ${this.getName()}`);
    }
    if (!this.hasCapability('doorbell_speaker_volume')) {
      await this.addCapability('doorbell_speaker_volume');
      this.homey.app.debug(`created capability doorbell_speaker_volume for ${this.getName()}`);
    }
  }

  async _initDoorbellData() {
    let doorbell = null;

    // Try V1 bootstrap first
    if (this.homey.app.isV1Available()) {
      const bootstrapData = this.homey.app.api.getBootstrap();
      if (bootstrapData && bootstrapData.cameras) {
        doorbell = bootstrapData.cameras.find(c => c.id === this.getData().id);
      }
    }

    // Fall back to V2 API
    if (!doorbell && this.homey.app.isV2Available()) {
      try {
        doorbell = await this.homey.app.apiV2.getCamera(this.getData().id);
      } catch (e) {
        this.homey.app.debug(`V2 getCamera failed for doorbell ${this.getData().id}: ${e}`);
      }
    }

    if (doorbell) {
      if (this.hasCapability('ip_address') && doorbell.host) {
        this.setCapabilityValue('ip_address', doorbell.host).catch(this.error);
      }
      if (this.hasCapability('camera_recording_status') && typeof doorbell.isRecording !== 'undefined') {
        this.setCapabilityValue('camera_recording_status', doorbell.isRecording).catch(this.error);
      }
      if (this.hasCapability('camera_recording_mode') && doorbell.recordingSettings && doorbell.recordingSettings.mode) {
        this.setCapabilityValue('camera_recording_mode',
          this.homey.__(`events.doorbell.${String(doorbell.recordingSettings.mode)
            .toLowerCase()}`)).catch(this.error);
      }
      if (this.hasCapability('camera_microphone_status') && typeof doorbell.isMicEnabled !== 'undefined') {
        this.setCapabilityValue('camera_microphone_status', doorbell.isMicEnabled).catch(this.error);
      }
      if (this.hasCapability('camera_nightvision_status') && typeof doorbell.isDark !== 'undefined') {
        this.setCapabilityValue('camera_nightvision_status', doorbell.isDark).catch(this.error);
      }
      if (this.hasCapability('camera_microphone_volume') && typeof doorbell.micVolume !== 'undefined') {
        this.setCapabilityValue('camera_microphone_volume', doorbell.micVolume).catch(this.error);
      }
      if (this.hasCapability('doorbell_ring_volume') && doorbell.speakerSettings) {
        this.setCapabilityValue('doorbell_ring_volume', doorbell.speakerSettings.ringVolume).catch(this.error);
      }
      if (this.hasCapability('doorbell_speaker_volume') && doorbell.speakerSettings) {
        this.setCapabilityValue('doorbell_speaker_volume', doorbell.speakerSettings.speakerVolume).catch(this.error);
      }
      if (this.hasCapability('camera_connection_status')) {
        const isConnected = doorbell.state === 'CONNECTED' || doorbell.isConnected === true;
        if (this.getCapabilityValue('camera_connection_status') !== isConnected) {
          this.onConnectionChanged(isConnected);
        }
        this.setCapabilityValue('camera_connection_status', isConnected).catch(this.error);
      }
      if (this.hasCapability('camera_nightvision_set') && doorbell.ispSettings && doorbell.ispSettings.irLedMode) {
        this.setCapabilityValue('camera_nightvision_set', doorbell.ispSettings.irLedMode).catch(this.error);
      }

      // Package camera
      if (doorbell.featureFlags && doorbell.featureFlags.hasPackageCamera) {
        await this._createSnapshotPackageImage();
      }
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

  onDoorbellRinging(lastRing) {
    const lastRingAt = this.getCapabilityValue('last_ring_at');

    // Check if the event date is newer
    if (!lastRingAt || lastRing > (lastRingAt + this.homey.app.ignoreEventsDoorbell)) {
      this.homey.api.realtime('com.ubnt.unifiprotect.updateWidgetDoorbell', { deviceId: this.getData().id });
      this.homey.app._doorbellRingingTrigger.trigger({
        ufp_ringing_camera: this.getName(),
      });

      this.driver._doorbellPressetTrigger.trigger(this, {
        ufp_pressed_camera: this.getName(),
      });
    }

    if (!lastRingAt) {
      if (this.homey.env.DEBUG) this.homey.app.debug(`set last_ring_at to last datetime: ${this.getData().id}`);
      this.setCapabilityValue('last_ring_at', lastRing)
        .catch(this.error);

    }
  }

  onMotionDetected(lastMotionTime, isMotionDetected) {
    const lastMotionAt = this.getCapabilityValue('last_motion_at');

    if (!lastMotionAt) {
      this.homey.app.debug(`set last_motion_at to last datetime: ${this.getData().id}`);
      this.setCapabilityValue('last_motion_at', lastMotionTime)
        .catch(this.error);
      return;
    }

    // Check if the event date is newer
    if (isMotionDetected && lastMotionTime > lastMotionAt) {
      const lastMotion = this.homey.app.toLocalTime(new Date(lastMotionTime));
      this.homey.app.debug(`new motion detected on Doorbell: ${this.getData().id} on ${lastMotion.toLocaleString()}`);

      this.setCapabilityValue('last_motion_at', lastMotionTime)
        .catch(this.error);
      this.setCapabilityValue('last_motion_date', lastMotion.toLocaleDateString())
        .catch(this.error);
      this.setCapabilityValue('last_motion_time', lastMotion.toLocaleTimeString())
        .catch(this.error);
      this.onMotionStart();
    } else if (!isMotionDetected && lastMotionTime > lastMotionAt) {
      const lastMotion = this.homey.app.toLocalTime(new Date(lastMotionTime));
      this.homey.app.debug(`motion detected ended on Doorbell: ${this.getData().id} on ${lastMotion.toLocaleString()}`);
      this.onMotionEnd();
      this.setCapabilityValue('last_motion_at', lastMotionTime)
        .catch(this.error);
    }
  }

  onFingerprintIdentified(payload, actionType = null, eventId = null) {
    this.homey.app.debug(`[Object] onFingerprintIdentified ${JSON.stringify(payload)}`);
    const lastFingerprintIdentifiedAt = this.getCapabilityValue('last_fingerprint_identified_at');

    if (typeof payload === 'undefined'
            || typeof payload.metadata === 'undefined'
            || typeof payload.metadata.fingerprint === 'undefined') {
      this.homey.app.debug('Fingerprint event has no metadata');
      return false;
    }
    if (payload.start <= (lastFingerprintIdentifiedAt + this.homey.app.ignoreEventsNfcFingerprint)) {
      this.homey.app.debug('Event is not newer then last event');
      return false;
    }
    this.setCapabilityValue('last_fingerprint_identified_at', payload.start).catch(this.error);
    const ulpId = payload.metadata.fingerprint.ulpId || null;
    if (ulpId) {
      this.homey.app.api.getCloudUserById(ulpId).then((user) => {
        this.homey.app.debug(`Fingerprint identified for user: ${JSON.stringify(user)}`);
        const email = user && user.email !== '' ? user.email : null;
        const person = user ? (email || user.username) : '';
        const firstName = user ? user.first_name : '';
        const lastName = user ? user.last_name : '';
        const uniqueId = user ? user.unique_id : ulpId;
        // Generic trigger
        this.homey.app._fingerPrintIdentifiedTrigger.trigger({
          ufp_fingerprint_identified_camera: this.getName(),
          ufp_fingerprint_identified_person: person,
          ufp_fingerprint_identified_first_name: firstName,
          ufp_fingerprint_identified_last_name: lastName,
          ufp_fingerprint_identified_user_unique_id: uniqueId,
        }).catch(this.error);

        // Device trigger
        this.driver._deviceFingerprintIdentifiedTrigger.trigger(this, {
          ufp_device_fingerprint_identified_person: person,
          ufp_device_fingerprint_identified_first_name: firstName,
          ufp_device_fingerprint_identified_last_name: lastName,
          ufp_device_fingerprint_identified_user_unique_id: uniqueId,
        }).catch(this.error);
      }).catch(this.error);
    } else {
      // Unknown fingerprint (ulpId is null) — fire trigger with empty user info
      this.homey.app._fingerPrintIdentifiedTrigger.trigger({
        ufp_fingerprint_identified_camera: this.getName(),
        ufp_fingerprint_identified_person: '',
        ufp_fingerprint_identified_first_name: '',
        ufp_fingerprint_identified_last_name: '',
        ufp_fingerprint_identified_user_unique_id: '',
      }).catch(this.error);

      this.driver._deviceFingerprintIdentifiedTrigger.trigger(this, {
        ufp_device_fingerprint_identified_person: '',
        ufp_device_fingerprint_identified_first_name: '',
        ufp_device_fingerprint_identified_last_name: '',
        ufp_device_fingerprint_identified_user_unique_id: '',
      }).catch(this.error);
    }
    return true;
  }

  onNFCCardScanned(payload, actionType = null, eventId = null) {
    this.homey.app.debug(`[Object] onNFCCardScanned ${JSON.stringify(payload)}`);
    const lastNFCCardScannedAt = this.getCapabilityValue('last_nfc_card_scanned_at');
    if (typeof payload === 'undefined'
            || typeof payload.metadata === 'undefined'
            || typeof payload.metadata.nfc === 'undefined') {
      this.homey.app.debug('NFC Card Event has no metadata');
      return false;
    }
    if (payload.start <= (lastNFCCardScannedAt + this.homey.app.ignoreEventsNfcFingerprint)) {
      this.homey.app.debug('Event is not newer then last event');
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
        // Generic trigger
        this.homey.app._nfcCardScannedTrigger.trigger({
          ufp_nfc_card_scanned_camera: this.getName(),
          ufp_nfc_card_scanned_person: person,
          ufp_nfc_card_scanned_first_name: firstName,
          ufp_nfc_card_scanned_last_name: lastName,
          ufp_nfc_card_scanned_user_unique_id: uniqueId,
          ufp_nfc_card_scanned_card_id: nfcId,
          ufp_nfc_card_scanned_nfc_id: nfcId,
        }).catch(this.error);

        // Device trigger
        this.driver._deviceNFCCardScannedTrigger.trigger(this, {
          ufp_device_nfc_card_scanned_person: person,
          ufp_device_nfc_card_scanned_first_name: firstName,
          ufp_device_nfc_card_scanned_last_name: lastName,
          ufp_device_nfc_card_scanned_user_unique_id: uniqueId,
          ufp_device_nfc_card_scanned_card_id: nfcId,
          ufp_device_nfc_card_scanned_nfc_id: nfcId,
        }).catch(this.error);
      }).catch(this.error);
    } else {
      // Unknown NFC card (ulpId is null) — fire unknown card triggers only
      this.homey.app._nfcUnknownCardScannedTrigger.trigger({
        ufp_nfc_unknown_card_scanned_camera: this.getName(),
        ufp_nfc_unknown_card_scanned_nfc_id: nfcId,
      }).catch(this.error);

      this.driver._deviceNFCUnknownCardScannedTrigger.trigger(this, {
        ufp_device_nfc_unknown_card_scanned_nfc_id: nfcId,
      }).catch(this.error);
    }
    return true;
  }

  onDoorAccess(payload, actionType = null, eventId = null) {
    this.homey.app.debug(`[Object] onDoorAccess ${JSON.stringify(payload)}`);

    if (typeof payload !== 'undefined'
            && typeof payload.type !== 'undefined'
            && payload.type === 'doorAccess'
            && typeof payload.metadata !== 'undefined'
            && typeof payload.metadata.unique_id !== 'undefined'
            && payload.metadata.unique_id !== null) {

      this.homey.app.api.getCloudUserById(payload.metadata.unique_id).then((user) => {
        // Generic trigger
        this.homey.app._doorAccessTrigger.trigger({
          ufp_door_access_camera: this.getName(),
          ufp_door_access_person: (user.email !== '' ? user.email : user.username),
          ufp_door_access_first_name: user.first_name,
          ufp_door_access_last_name: user.last_name,
          ufp_door_access_user_unique_id: user.unique_id,
        }).catch(this.error);

        // Device trigger
        this.driver._deviceDoorAccessTrigger.trigger(this, {
          ufp_device_door_access_person: (user.email !== '' ? user.email : user.username),
          ufp_device_door_access_first_name: user.first_name,
          ufp_device_door_access_last_name: user.last_name,
          ufp_device_door_access_user_unique_id: user.unique_id,
        }).catch(this.error);
      }).catch(this.error);

      return true;
    }

    this.homey.app.debug('DoorAccess event is not valid!');
    return false;
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
      this.setCapabilityValue('camera_recording_status', isRecording);
    }
  }

  onIsMicEnabled(isMicEnabled) {
    // Debug information about playload
    if (this.hasCapability('camera_microphone_status')) {
      this.setCapabilityValue('camera_microphone_status', isMicEnabled);
    }
  }

  onIsConnected(isConnected) {
    // Debug information about playload
    if (this.getCapabilityValue('camera_connection_status') !== isConnected) {
      this.onConnectionChanged(isConnected);
    }
    this.setCapabilityValue('camera_connection_status', isConnected);
  }

  onMicVolume(micVolume) {
    // Debug information about playload
    if (this.hasCapability('camera_microphone_volume')) {
      this.setCapabilityValue('camera_microphone_volume', micVolume);
    }
  }

  onRingVolume(volume) {
    if (this.hasCapability('doorbell_ring_volume')) {
      this.setCapabilityValue('doorbell_ring_volume', volume).catch(this.error);
    }
  }

  onSpeakerVolume(volume) {
    if (this.hasCapability('doorbell_speaker_volume')) {
      this.setCapabilityValue('doorbell_speaker_volume', volume).catch(this.error);
    }
  }

  onRecordingMode(mode) {
    // Debug information about playload
    if (this.hasCapability('camera_recording_mode')) {
      this.setCapabilityValue('camera_recording_mode',
        this.homey.__(`events.Doorbell.${String(mode)
          .toLowerCase()}`));
    }
  }

  async _setVideoUrl() {
    this.homey.app.debug(`Getting rtsp Url for camera ${this.getName()}.`);
    try {
      // Create the video object
      this.video = await this.homey.videos.createVideoRTSP({
        allowInvalidCertificates: true,
        demuxer: 'hevc',
      });

      // Register the video url listener
      this.video.registerVideoUrlListener(async () => {
        return {
          url: this.rtspUrl,
        };
      });

      // Get rtsp url from device settings
      if (this.settings.rtspUrl && this.settings.rtspUrl !== '') {
        this.rtspUrl = this.settings.rtspUrl;
        this.log(`Using custom RTSP URL for doorbell ${this.getName()}: ${this.rtspUrl}`);
        return;
      }

      // get rtsp url from api
      if (this.homey.app.isV1Available()) {
        this.homey.app.api.getStreamUrl(this.getData()).then(((rtspUrl) => {
          this.log(`RTSP URL for doorbell ${this.getName()}: ${rtspUrl}`);
          this.rtspUrl = rtspUrl;
        })).catch(this.error);
      } else if (this.homey.app.isV2Available()) {
        try {
          const streams = await this.homey.app.apiV2.getRtspsStream(this.getData().id, ['high']);
          if (streams && streams.high) {
            this.rtspUrl = streams.high;
            this.log(`RTSPS URL (V2) for doorbell ${this.getName()}: ${this.rtspUrl}`);
          }
        } catch (e) {
          this.homey.app.debug(`V2 getRtspsStream failed for ${this.getName()}: ${e}`);
        }
      }

      this.setCameraVideo('snapshot', `${this.getName()} Video`, this.video);

      // Package camera
      // Create the video object
      this.packageVideo = await this.homey.videos.createVideoRTSP({
        allowInvalidCertificates: true,
        demuxer: 'hevc',
      });

      // Register the video url listener
      this.packageVideo.registerVideoUrlListener(async () => {
        return {
          url: this.rtspPackageUrl,
        };
      });

      // Get rtsp url from device settings
      if (this.settings.rtspPackageUrl && this.settings.rtspPackageUrl !== '') {
        this.rtspPackageUrl = this.settings.rtspPackageUrl;
        this.log(`Using custom RTSP URL for doorbell ${this.getName()}: ${this.rtspPackageUrl}`);
        return;
      }

      // get rtsp url from api
      if (this.homey.app.isV1Available()) {
        this.homey.app.api.getPackageStreamUrl(this.getData()).then(((rtspPackageUrl) => {
          this.log(`RTSP URL for doorbell ${this.getName()}: ${rtspPackageUrl}`);
          this.rtspPackageUrl = rtspPackageUrl;
        })).catch(this.error);
      } else if (this.homey.app.isV2Available()) {
        try {
          const streams = await this.homey.app.apiV2.getRtspsStream(this.getData().id, ['package']);
          if (streams && streams.package) {
            this.rtspPackageUrl = streams.package;
            this.log(`RTSPS Package URL (V2) for doorbell ${this.getName()}: ${this.rtspPackageUrl}`);
          }
        } catch (e) {
          this.homey.app.debug(`V2 getRtspsStream (package) failed for ${this.getName()}: ${e}`);
        }
      }

      this.setCameraVideo('package-snapshot', `${this.getName()} Package Video`, this.packageVideo);
    } catch (err) {
      this.error('Error creating camera:', err);
    }
  }

  async _createSnapshotImage(triggerFlow = false) {
    this.homey.app.debug(`Creating snapshot image for doorbell ${this.getName()}.`);

    this._snapshotImage = await this.homey.images.createImage();

    const ipAddress = this.getCapabilityValue('ip_address');

    this._snapshotImage.setStream(async (stream) => {
      let snapshotUrl = null;
      const headers = {};

      if (this.homey.app.useCameraSnapshot) {
        snapshotUrl = `https://${ipAddress}/snap.jpeg`;
      } else if (this.homey.app.isV1Available()) {
        await this.homey.app.api.createSnapshotUrl(this.getData())
          .then((url) => {
            snapshotUrl = url;
          })
          .catch(this.error.bind(this, 'Could not create snapshot URL.'));
        headers['Cookie'] = this.homey.app.api.getProxyCookieToken();
      } else if (this.homey.app.isV2Available()) {
        snapshotUrl = this.homey.app.apiV2.getSnapshotUrl(this.getData().id);
        const v2Headers = this.homey.app.apiV2.getSnapshotHeaders();
        Object.assign(headers, v2Headers);
      }

      if (!snapshotUrl) {
        throw new Error('Invalid snapshot url.');
      }

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
      const getStreamUrl = async () => {
        if (this.homey.app.isV1Available()) {
          return this.homey.app.api.getStreamUrl(this.getData());
        }
        return this.rtspUrl || '';
      };

      getStreamUrl().then((rtspUrl) => {
        this.homey.app.triggerSnapshotTrigger({
          ufv_snapshot_token: this._snapshotImage,
          ufv_snapshot_camera: this.getName(),
          ufv_snapshot_snapshot_url: '',
          ufv_snapshot_stream_url: rtspUrl,
        });
      }).catch(this.log);
    }

    this.setCameraImage('snapshot', this.getName(), this._snapshotImage).catch(this.error);

    this.cloudUrl = this._snapshotImage.cloudUrl;

    this.homey.app.debug(`Created snapshot image for doorbell ${this.getName()}.`);
  }

  async _createSnapshotPackageImage(triggerFlow = false) {
    return new Promise(async (resolve, reject) => {
      this._snapshotPackageImage = await this.homey.images.createImage();
      this.homey.app.debug(`Creating snapshot packages image for doorbell ${this.getName()}.`);

      const ipAddress = this.getCapabilityValue('ip_address');

      this._snapshotPackageImage.setStream(async (stream) => {
        let snapshotUrl = null;
        const headers = {};

        if (this.homey.app.useCameraSnapshot) {
          snapshotUrl = `https://${ipAddress}/snap_2.jpeg`;
        } else if (this.homey.app.isV1Available()) {
          await this.homey.app.api.createPackageSnapshotUrl(this.getData())
            .then((url) => {
              snapshotUrl = url;
            });
          headers['Cookie'] = this.homey.app.api.getProxyCookieToken();
        } else if (this.homey.app.isV2Available()) {
          // V2 snapshot endpoint (package camera not separately supported in V2)
          snapshotUrl = this.homey.app.apiV2.getSnapshotUrl(this.getData().id);
          const v2Headers = this.homey.app.apiV2.getSnapshotHeaders();
          Object.assign(headers, v2Headers);
        }

        if (!snapshotUrl) {
          reject('Invalid snapshot url.');
          return;
        }

        const agent = new https.Agent({
          rejectUnauthorized: false,
          keepAlive: false,
        });

        // Fetch image
        const res = await fetch(snapshotUrl, {
          agent,
          headers,
        });
        if (!res.ok) {
          reject('Could not fetch snapshot image.');
          return;
        }

        return res.body.pipe(stream);
      });

      if (triggerFlow) {
        const getStreamUrl = async () => {
          if (this.homey.app.isV1Available()) {
            return this.homey.app.api.getPackageStreamUrl(this.getData());
          }
          return this.rtspPackageUrl || '';
        };

        getStreamUrl().then((rtspUrl) => {
          this.homey.app._packageSnapshotTrigger.trigger({
            ufv_snapshot_token: this._snapshotPackageImage,
            ufv_snapshot_camera: this.getName(),
            ufv_snapshot_snapshot_url: '',
            ufv_snapshot_stream_url: rtspUrl,
          });
        }).catch(this.error);
      }

      this.setCameraImage('package-snapshot', this.homey.__('package_camera', { name: this.getName() }), this._snapshotPackageImage).catch(this.error);

      this.cloudUrlPackage = this._snapshotPackageImage.cloudUrl;

      this.homey.app.debug(`Created package snapshot image for doorbell ${this.getName()}.`);
      resolve();
    });
  }

}

module.exports = Doorbell;
