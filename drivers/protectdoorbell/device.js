'use strict';

const Homey = require('homey');
const fetch = require('node-fetch');
const https = require('https');
const SmartDetectionEvent = require('../../library/Models/SmartDetectionEvent');

class Doorbell extends Homey.Device {
  /**
     * onInit is called when the device is initialized.
     */
  async onInit() {
    this.device = this;
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
      return this.homey.app.api.setMicVolume(this.getData(), value);
    });

    this.registerCapabilityListener('camera_nightvision_set', async (value) => {
      this.homey.app.debug('camera_nightvision_set');
      return this.homey.app.api.setNightVisionMode(this.getData(), value);
    });

    await this._createMissingCapabilities();
    await this._createSnapshotImage();
    await this._setVideoUrl();
    await this._initDoorbellData();
  }

  async waitForBootstrap() {
    if (typeof this.homey.app.api.getLastUpdateId() !== 'undefined' && this.homey.app.api.getLastUpdateId() !== null) {
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

  }

  async _initDoorbellData() {
    const DoorbellData = this.homey.app.api.getBootstrap();

    if (DoorbellData) {
      for (const Doorbell of DoorbellData.cameras) {
        if (Doorbell.id === this.getData().id) {
          if (this.hasCapability('ip_address')) {
            this.setCapabilityValue('ip_address', Doorbell.host).catch(this.error);
          }
          if (this.hasCapability('camera_recording_status')) {
            this.setCapabilityValue('camera_recording_status', Doorbell.isRecording).catch(this.error);
          }
          if (this.hasCapability('camera_recording_mode')) {
            this.setCapabilityValue('camera_recording_mode',
              this.homey.__(`events.doorbell.${String(Doorbell.recordingSettings.mode)
                .toLowerCase()}`)).catch(this.error);
          }
          if (this.hasCapability('camera_microphone_status')) {
            this.setCapabilityValue('camera_microphone_status', Doorbell.isMicEnabled).catch(this.error);
          }
          if (this.hasCapability('camera_nightvision_status')) {
            this.setCapabilityValue('camera_nightvision_status', Doorbell.isDark).catch(this.error);
          }
          if (this.hasCapability('camera_microphone_volume')) {
            this.setCapabilityValue('camera_microphone_volume', Doorbell.micVolume).catch(this.error);
          }
          if (this.hasCapability('camera_connection_status')) {
            if (this.getCapabilityValue('camera_connection_status') !== Doorbell.isConnected) {
              this.onConnectionChanged(Doorbell.isConnected);
            }
            this.setCapabilityValue('camera_connection_status', Doorbell.isConnected).catch(this.error);
          }
          if (this.hasCapability('camera_nightvision_set')) {
            this.setCapabilityValue('camera_nightvision_set', Doorbell.ispSettings.irLedMode).catch(this.error);
          }

          // Package camera
          if (Doorbell.featureFlags.hasPackageCamera) {
            //
            await this._createSnapshotPackageImage();
          }

        }
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
    if (!lastRingAt || lastRing > (lastRingAt + 2)) {
      this.homey.app._doorbellRingingTrigger.trigger({
        ufp_ringing_camera: this.getName(),
      });

      this.driver._doorbellPressetTrigger.trigger(this, {
        ufp_pressed_camera: this.getName(),
      });
    }

    if (lastRing) {
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

    if (typeof payload !== 'undefined'
            && typeof payload.metadata !== 'undefined'
            && typeof payload.metadata.fingerprint !== 'undefined'
            && typeof payload.metadata.fingerprint.ulpId !== 'undefined'
            && payload.metadata.fingerprint.ulpId !== null) {
      this.homey.app.api.getCloudUserById(payload.metadata.fingerprint.ulpId).then((user) => {
        this.homey.app.debug(`Fingerprint identified for user: ${JSON.stringify(user)}`);
        // Generic trigger
        this.homey.app._fingerPrintIdentifiedTrigger.trigger({
          ufp_fingerprint_identified_camera: this.getName(),
          ufp_fingerprint_identified_person: (user.email !== '' ? user.email : user.username),
          ufp_fingerprint_identified_first_name: user.first_name,
          ufp_fingerprint_identified_last_name: user.last_name,
          ufp_fingerprint_identified_user_unique_id: user.unique_id,
        }).catch(this.error);

        // Device trigger
        this.driver._deviceFingerprintIdentifiedTrigger.trigger(this, {
          ufp_device_fingerprint_identified_person: (user.email !== '' ? user.email : user.username),
          ufp_device_fingerprint_identified_first_name: user.first_name,
          ufp_device_fingerprint_identified_last_name: user.last_name,
          ufp_device_fingerprint_identified_user_unique_id: user.unique_id,
        }).catch(this.error);
      }).catch(this.error);
      return true;
    }
    // Fingerprint is not valid
    this.homey.app.debug('Fingerprint is not valid!');
    return false;
  }

  onNFCCardScanned(payload, actionType = null, eventId = null) {
    this.homey.app.debug(`[Object] onNFCCardScanned ${JSON.stringify(payload)}`);

    if (typeof payload !== 'undefined'
            && typeof payload.metadata !== 'undefined'
            && typeof payload.metadata.nfc !== 'undefined'
            && typeof payload.metadata.nfc.ulpId !== 'undefined'
            && payload.metadata.nfc.ulpId !== null) {
      this.homey.app.api.getCloudUserById(payload.metadata.nfc.ulpId).then((user) => {
        // Generic trigger
        this.homey.app._nfcCardScannedTrigger.trigger({
          ufp_nfc_card_scanned_camera: this.getName(),
          ufp_nfc_card_scanned_person: (user.email !== '' ? user.email : user.username),
          ufp_nfc_card_scanned_first_name: user.first_name,
          ufp_nfc_card_scanned_last_name: user.last_name,
          ufp_nfc_card_scanned_user_unique_id: user.unique_id,
          ufp_nfc_card_scanned_card_id: payload.metadata.nfc.nfcId,
        }).catch(this.error);

        // Device trigger
        this.driver._deviceNFCCardScannedTrigger.trigger(this, {
          ufp_device_nfc_card_scanned_person: (user.email !== '' ? user.email : user.username),
          ufp_device_nfc_card_scanned_first_name: user.first_name,
          ufp_device_nfc_card_scanned_last_name: user.last_name,
          ufp_device_nfc_card_scanned_user_unique_id: user.unique_id,
          ufp_device_nfc_card_scanned_card_id: payload.metadata.nfc.nfcId,
        }).catch(this.error);
      }).catch(this.error);
      return true;
    }

    this.homey.app.debug('NFC Card Event is not valid!');
    return false;
  }

  onDoorAccess(payload, actionType = null, eventId = null) {
    this.homey.app.debug(`[Object] onDoorAccess ${JSON.stringify(payload)}`);

    if (typeof payload !== 'undefined'
            && typeof payload.type !== 'undefined'
            && payload.type === 'doorAccess'
            && typeof payload.metadata !== 'undefined'
            && typeof payload.metadata.unique_id === 'undefined'
            && payload.metadata.unique_id === null) {

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
    let lastDetectionAt = null;
    let score = null;
    let smartDetectTypes = null;
    let event = null;
    let zones = '';

    if (actionType === 'add') {
      event = this.setSmartDetectionEvent(eventId, payload.start, payload.smartDetectTypes, payload.score);
    } else if (actionType === 'update') {
      event = this.getSmartDetectionEvent(eventId);
      if (event !== null) {
        event.detectionTypes = payload.smartDetectTypes;
      }
    }

    this.homey.app.debug(`[Object] onSmartDetection ${JSON.stringify(event)}`);

    if (event !== null) {
      lastDetectionAt = event.detectionTime;
      score = event.detectionScore;
      smartDetectTypes = event.detectionTypes;

      if (payload?.metadata?.zonesStatus && typeof payload.metadata.zonesStatus === 'object') {
        zones = Object.entries(payload.metadata.zonesStatus)
          .filter(([_, zone]) => zone.status !== 'none')
          .map(([key, _]) => key)
          .join(', ');
      }
    } else {
      this.homey.app.debug(`[404] Event not found [${eventId}] ${JSON.stringify(payload)}`);
      return;
    }

    const lastDetection = this.homey.app.toLocalTime(new Date(lastDetectionAt));
    // Set last smart detection to current datetime
    this.setCapabilityValue('last_smart_detection_at', lastDetectionAt)
      .catch(this.error);
    this.setCapabilityValue('last_smart_detection_date', lastDetection.toLocaleDateString())
      .catch(this.error);
    this.setCapabilityValue('last_smart_detection_time', lastDetection.toLocaleTimeString())
      .catch(this.error);
    this.setCapabilityValue('last_smart_detection_score', score)
      .catch(this.error);

    // const smartDetectionType = smartDetectTypes.join(',');

    // fire trigger (per detection type)
    if (smartDetectTypes.length > 0) {
      for (const smartDetectionType of smartDetectTypes) {
        this.homey.app.debug(`[C] smart detection event on Doorbell ${this.getData().id}, with type ${smartDetectionType}`);
        // fire trigger
        if (smartDetectionType === 'person') {
          this.triggerSmartDetectionTriggerPerson(score, zones);
        } else if (smartDetectionType === 'vehicle') {
          this.triggerSmartDetectionTriggerVehicle(score, zones);
        } else if (smartDetectionType === 'animal') {
          this.triggerSmartDetectionTriggerAnimal(score, zones);
        } else if (smartDetectionType === 'package') {
          this.triggerSmartDetectionTriggerPackage(score, zones);
        } else if (smartDetectionType === 'licensePlate') {
          this.triggerSmartDetectionTriggerLicensePlate(score, zones);
        } else if (smartDetectionType === 'face') {
          this.triggerSmartDetectionTriggerFace(score, zones);
        }
      }
    } else {
      this.triggerSmartDetectionTriggerUnknown(score, zones);
    }
  }

  onAudioDetection(payload, actionType = null, eventId = null) {
    let score = null;
    let audioDetectTypes = null;
    let event = null;

    if (actionType === 'add') {
      event = this.setSmartDetectionEvent(eventId, payload.start, payload.smartDetectTypes, payload.score);
    } else if (actionType === 'update') {
      event = this.getSmartDetectionEvent(eventId);
      if (event !== null) {
        event.detectionTypes = payload.smartDetectTypes;
      }
    }

    this.homey.app.debug(`[Audio Doorbell] onAudioDetection ${JSON.stringify(event)}`);

    if (event !== null) {
      score = event.detectionScore;
      audioDetectTypes = event.detectionTypes;
    }

    // Fire triggers for audio detection
    if (audioDetectTypes && audioDetectTypes.length > 0) {
      // Fire triggers for each specific audio type detected
      for (const audioDetectionType of audioDetectTypes) {
        this.homey.app.debug(`audio detection event on Doorbell ${this.getData().id}, with type ${audioDetectionType}`);

        // Map the internal API names to readable names
        const readableType = this.mapAudioDetectionType(audioDetectionType);

        // Fire audio detection trigger with the mapped type
        this.triggerAudioDetectionTrigger(audioDetectionType, readableType, score);
      }
    } else {
      // No specific types detected (or empty array), but still fire "any" trigger
      this.homey.app.debug(`audio detection event on Doorbell ${this.getData().id}, with unspecified type (any)`);
      this.triggerAudioDetectionTrigger('any', 'any', score || 0);
    }
  }

  mapAudioDetectionType(apiType) {
    const typeMap = {
      alrmSmoke: 'smoke',
      alrmCmonx: 'cmonx',
      alrmSiren: 'siren',
      alrmBabyCry: 'baby_cry',
      alrmSpeak: 'speak',
      alrmBark: 'bark',
      alrmBurglar: 'burglar',
      alrmCarHorn: 'car_horn',
      alrmGlassBreak: 'glass_break',
    };
    return typeMap[apiType] || apiType;
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
      const video = await this.homey.videos.createVideoRTSP({
        allowInvalidCertificates: true,
        demuxer: 'h265',
      });

      video.registerVideoUrlListener(async () => {
        await this.homey.app.api.getStreamUrl(this.getData()).then(((rtspUrl) => {
          return {
            url: rtspUrl,
          };
        }));
      });

      await this.setCameraVideo('video', `${this.getName()} Video`, video);
    } catch (err) {
      this.error('Error creating camera:', err);
    }
  }

  async _createSnapshotImage(triggerFlow = false) {
    this.homey.app.debug(`Creating snapshot image for doorbell ${this.getName()}.`);

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

    this.setCameraImage('snapshot', this.getName(), this._snapshotImage);

    this.homey.app.debug(`Created snapshot image for doorbell ${this.getName()}.`);
  }

  async _createSnapshotPackageImage(triggerFlow = false) {
    return new Promise(async (resolve, reject) => {
      this._snapshotPackageImage = await this.homey.images.createImage();
      this.homey.app.debug(`Creating snapshot packages image for doorbell ${this.getName()}.`);

      const ipAddress = this.getCapabilityValue('ip_address');

      this._snapshotPackageImage.setStream(async (stream) => {
        // Obtain snapshot URL
        let snapshotUrl = null;

        if (this.homey.app.useCameraSnapshot) {
          snapshotUrl = `https://${ipAddress}/snap_2.jpeg`;
        } else {
          await this.homey.app.api.createPackageSnapshotUrl(this.getData())
            .then((url) => {
              snapshotUrl = url;
            });
        }
        reject('Invalid snapshot url.');
        if (!snapshotUrl) {
          reject('Invalid snapshot url.');
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
        if (!res.ok) {
          reject('Could not fetch snapshot image.');
        }

        return res.body.pipe(stream);
      });

      if (triggerFlow) {
        this.homey.app.api.getPackageStreamUrl(this.getData()).then(((rtspUrl) => {
          this.homey.app._packageSnapshotTrigger.trigger({
            ufv_snapshot_token: this._snapshotPackageImage,
            ufv_snapshot_camera: this.getName(),
            ufv_snapshot_snapshot_url: '',
            ufv_snapshot_stream_url: rtspUrl,
          });
        }));
      }

      this.setCameraImage('package-snapshot', this.homey.__('package_camera', { name: this.getName() }), this._snapshotPackageImage);

      this.homey.app.debug(`Created package snapshot image for doorbell ${this.getName()}.`);
      resolve();
    });
  }

  triggerSmartDetectionTriggerUnknown(score, zones) {
    // Generic trigger
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'unknown',
      score,
      zones,
    }).catch(this.error);
    // device
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'unknown',
      score,
      zones,
    }).catch(this.error);
  }

  triggerSmartDetectionTriggerPerson(score, zones) {
    this.homey.app.debug('this.homey.app._smartDetectionTrigger.trigger');
    // Generic trigger
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'person',
      score,
      zones,
    }).catch(this.error);

    this.homey.app.debug('this.driver._smartDetectionTrigger.trigger');
    // device
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'person',
      score,
      zones,
    }).catch(this.error);

    this.homey.app.debug('this.homey.app._smartDetectionTriggerPerson.trigger');
    // Detection Type trigger
    // App trigger
    this.homey.app._smartDetectionTriggerPerson.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);

    this.homey.app.debug('this.driver._deviceSmartDetectionTriggerPerson.trigger');
    // Device trigger
    this.driver._deviceSmartDetectionTriggerPerson.trigger(this, {
      score,
      zones,
    }).catch(this.error).catch(this.error);
  }

  triggerSmartDetectionTriggerVehicle(score, zones) {
    // Generic trigger
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'vehicle',
      score,
      zones,
    }).catch(this.error);
    // device
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'vehicle',
      score,
      zones,
    }).catch(this.error);
    // Detection Type trigger
    // App trigger
    this.homey.app._smartDetectionTriggerVehicle.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    // Device trigger
    this.driver._deviceSmartDetectionTriggerVehicle.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  }

  triggerSmartDetectionTriggerAnimal(score, zones) {
    // Generic trigger
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'animal',
      score,
      zones,
    }).catch(this.error);
    // device
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'animal',
      score,
      zones,
    }).catch(this.error);
    // Detection Type trigger
    // App trigger
    this.homey.app._smartDetectionTriggerAnimal.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    // Device trigger
    this.driver._deviceSmartDetectionTriggerAnimal.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  }

  triggerSmartDetectionTriggerPackage(score, zones) {
    // Generic trigger
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'package',
      score,
      zones,
    }).catch(this.error);
    // device
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'package',
      score,
      zones,
    }).catch(this.error);
    // Detection Type trigger
    // App trigger
    this.homey.app._smartDetectionTriggerPackage.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    // Device trigger
    this.driver._deviceSmartDetectionTriggerPackage.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  }

  triggerSmartDetectionTriggerLicensePlate(score, zones) {
    // Generic trigger
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'licensePlate',
      score,
      zones,
    }).catch(this.error);
    // Dedicated trigger
    this.homey.app._smartDetectionTriggerLicensePlate.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    // Device trigger
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'licensePlate',
      score,
      zones,
    }).catch(this.error);
    // Device trigger
    this.driver._deviceSmartDetectionTriggerLicensePlate.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  }

  triggerSmartDetectionTriggerFace(score, zones) {
    // Generic trigger
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'face',
      score,
      zones,
    }).catch(this.error);
    // Dedicated trigger
    this.homey.app._smartDetectionTriggerFace.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    // Device trigger
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'face',
      score,
      zones,
    }).catch(this.error);
    // Device trigger
    this.driver._deviceSmartDetectionTriggerFace.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  }

  triggerAudioDetectionTrigger(audioType, readableType, score) {
    // Map internal audio type to dropdown value
    const audioTypeMap = {
      alrmSmoke: 'smoke',
      alrmCmonx: 'cmonx',
      alrmSiren: 'siren',
      alrmBabyCry: 'baby_cry',
      alrmSpeak: 'speak',
      alrmBark: 'bark',
      alrmBurglar: 'burglar',
      alrmCarHorn: 'car_horn',
      alrmGlassBreak: 'glass_break',
    };

    const mappedType = audioTypeMap[audioType] || audioType;

    // Device-specific audio detection trigger with state for dropdown filter
    this.driver._deviceAudioDetectionTrigger.trigger(this, {
      audio_detection_type: mappedType,
      score,
    }, {
      audio_detection_type: mappedType,
    }).catch(this.error);
  }

  getSmartDetectionEvent(event_id) {
    return this.getStoreValue(event_id);
  }

  setSmartDetectionEvent(event_id, smartDetectionTime, smartDetectionType, smartDetectionScore) {
    const event = new SmartDetectionEvent(smartDetectionTime, smartDetectionType, smartDetectionScore, event_id);
    this.setStoreValue(event_id, event).catch(this.error);
    return event;
  }

  cleanSmartDetectionEvents() {
    const events = this.getStoreKeys();

    events.forEach((eventId) => {
      const event = this.getStoreValue(eventId);
      const currentTime = this.homey.app.getUnixTimestamp();
      if ((currentTime - event.detectionTime) > 86400) {
        this.unsetStoreValue(eventId).catch(this.error);
      }
    });
  }

}

module.exports = Doorbell;
