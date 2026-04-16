'use strict';

const SmartDetectionEvent = require('./Models/SmartDetectionEvent');

/**
 * SmartDetectionMixin
 *
 * Shared smart detection + audio detection logic for Camera and Doorbell devices.
 * Apply via delegating methods (see camera/device.js and doorbell/device.js).
 *
 * Race condition fix:
 *   UniFi Protect sends 'add' first with smartDetectTypes: [] and fills
 *   in the types via an 'update'. Triggers are only fired once types are known.
 */
const SmartDetectionMixin = {

  // --------------------------------------------------------------------------
  // In-memory event store
  // --------------------------------------------------------------------------

  _getEventStore() {
    if (!this._smartDetectionEvents) {
      this._smartDetectionEvents = new Map();
    }
    return this._smartDetectionEvents;
  },

  getSmartDetectionEvent(eventId) {
    return this._getEventStore().get(eventId) || null;
  },

  setSmartDetectionEvent(eventId, detectionTime, detectionTypes, detectionScore) {
    const event = new SmartDetectionEvent(detectionTime, detectionTypes, detectionScore, eventId);
    this._getEventStore().set(eventId, event);
    return event;
  },

  cleanSmartDetectionEvents() {
    const currentTime = this.homey.app.getUnixTimestamp();
    for (const [eventId, event] of this._getEventStore()) {
      if ((currentTime - event.detectionTime) > 86400000) {
        this._getEventStore().delete(eventId);
      }
    }
  },

  // --------------------------------------------------------------------------
  // Smart detection (visual)
  // --------------------------------------------------------------------------

  onSmartDetection(payload, actionType, eventId) {
    let event = null;

    if (actionType === 'add') {
      event = this.setSmartDetectionEvent(
        eventId,
        payload.start,
        payload.smartDetectTypes || [],
        payload.score,
      );
      if (!event.detectionTypes || event.detectionTypes.length === 0) {
        this.homey.app.debug('[SmartDetection] add: waiting for update [' + eventId + ']');
        return;
      }
    } else if (actionType === 'update') {
      event = this.getSmartDetectionEvent(eventId);
      if (event === null) {
        this.homey.app.debug('[SmartDetection] update for unknown event [' + eventId + '] - ignoring');
        return;
      }
      if (payload.smartDetectTypes !== undefined) {
        event.detectionTypes = payload.smartDetectTypes;
      }
      if (payload.score !== undefined) {
        event.detectionScore = payload.score;
      }
    } else {
      this.homey.app.debug('[SmartDetection] unknown actionType: ' + actionType);
      return;
    }

    this.homey.app.debug('[SmartDetection] onSmartDetection ' + JSON.stringify(event));

    if (!event.detectionTypes || event.detectionTypes.length === 0) {
      this.homey.app.debug('[SmartDetection] still empty types [' + eventId + '] - skipping');
      return;
    }

    const lastDetectionAt = event.detectionTime;
    const score = typeof event.detectionScore === 'number' ? event.detectionScore : 0;
    const smartDetectTypes = event.detectionTypes;

    let zones = '';
    if (payload && payload.metadata && payload.metadata.zonesStatus
      && typeof payload.metadata.zonesStatus === 'object') {
      zones = Object.entries(payload.metadata.zonesStatus)
        .filter(([, zone]) => zone.status !== 'none')
        .map(([key]) => key)
        .join(', ');
    }

    const lastDetection = this.homey.app.toLocalTime(new Date(lastDetectionAt));
    this.setCapabilityValue('last_smart_detection_at', lastDetectionAt).catch(this.error);
    this.setCapabilityValue('last_smart_detection_date', lastDetection.toLocaleDateString()).catch(this.error);
    this.setCapabilityValue('last_smart_detection_time', lastDetection.toLocaleTimeString()).catch(this.error);
    if (typeof score === 'number') {
      this.setCapabilityValue('last_smart_detection_score', score).catch(this.error);
    }

    if (smartDetectTypes.length > 0) {
      for (const type of smartDetectTypes) {
        this.homey.app.debug('[SmartDetection] type=' + type + ' device=' + this.getData().id);
        if (type === 'person') {
          this.triggerSmartDetectionTriggerPerson(score, zones);
        } else if (type === 'vehicle') {
          this.triggerSmartDetectionTriggerVehicle(score, zones);
        } else if (type === 'animal') {
          this.triggerSmartDetectionTriggerAnimal(score, zones);
        } else if (type === 'package') {
          this.triggerSmartDetectionTriggerPackage(score, zones);
        } else if (type === 'licensePlate') {
          this.triggerSmartDetectionTriggerLicensePlate(score, zones);
        } else if (type === 'face') {
          this.triggerSmartDetectionTriggerFace(score, zones);
        } else {
          this.homey.app.debug(`[SmartDetection] unknown type: ${type}`);
        }
      }
    } else {
      this.triggerSmartDetectionTriggerUnknown(score, zones);
    }
  },

  // --------------------------------------------------------------------------
  // Audio detection
  // --------------------------------------------------------------------------

  onAudioDetection(payload, actionType, eventId) {
    let event = null;

    if (actionType === 'add') {
      event = this.setSmartDetectionEvent(
        eventId,
        payload.start,
        payload.smartDetectTypes || [],
        payload.score,
      );
      if (!event.detectionTypes || event.detectionTypes.length === 0) {
        this.homey.app.debug(`[AudioDetection] add: waiting for update [${eventId}]`);
        return;
      }
    } else if (actionType === 'update') {
      event = this.getSmartDetectionEvent(eventId);
      if (event === null) {
        this.homey.app.debug(`[AudioDetection] update for unknown event [${eventId}] - ignoring`);
        return;
      }
      if (payload.smartDetectTypes !== undefined) {
        event.detectionTypes = payload.smartDetectTypes;
      }
      if (payload.score !== undefined) {
        event.detectionScore = payload.score;
      }
    } else {
      this.homey.app.debug(`[AudioDetection] unknown actionType: ${actionType}`);
      return;
    }

    this.homey.app.debug(`[AudioDetection] onAudioDetection ${JSON.stringify(event)}`);

    const score = event.detectionScore;
    const audioDetectTypes = event.detectionTypes;

    if (audioDetectTypes && audioDetectTypes.length > 0) {
      for (const audioType of audioDetectTypes) {
        this.homey.app.debug(`[AudioDetection] type=${audioType} device=${this.getData().id}`);
        const readableType = this.mapAudioDetectionType(audioType);
        this.triggerAudioDetectionTrigger(audioType, readableType, score);
      }
    } else {
      this.homey.app.debug(`[AudioDetection] still empty types [${eventId}] - skipping`);
    }
  },

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
  },

  // --------------------------------------------------------------------------
  // Smart detection triggers
  // --------------------------------------------------------------------------

  triggerSmartDetectionTriggerUnknown(score, zones) {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'unknown',
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'unknown',
      score,
      zones,
    }).catch(this.error);
  },

  triggerSmartDetectionTriggerPerson(score, zones) {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'person',
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'person',
      score,
      zones,
    }).catch(this.error);
    this.homey.app._smartDetectionTriggerPerson.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTriggerPerson.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  },

  triggerSmartDetectionTriggerVehicle(score, zones) {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'vehicle',
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'vehicle',
      score,
      zones,
    }).catch(this.error);
    this.homey.app._smartDetectionTriggerVehicle.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    // Fixed: camera incorrectly fired _deviceSmartDetectionTriggerAnimal for vehicles
    this.driver._deviceSmartDetectionTriggerVehicle.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  },

  triggerSmartDetectionTriggerAnimal(score, zones) {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'animal',
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'animal',
      score,
      zones,
    }).catch(this.error);
    this.homey.app._smartDetectionTriggerAnimal.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTriggerAnimal.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  },

  triggerSmartDetectionTriggerPackage(score, zones) {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'package',
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'package',
      score,
      zones,
    }).catch(this.error);
    this.homey.app._smartDetectionTriggerPackage.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTriggerPackage.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  },

  triggerSmartDetectionTriggerLicensePlate(score, zones) {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'licensePlate',
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'licensePlate',
      score,
      zones,
    }).catch(this.error);
    this.homey.app._smartDetectionTriggerLicensePlate.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTriggerLicensePlate.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  },

  triggerSmartDetectionTriggerFace(score, zones) {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'face',
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'face',
      score,
      zones,
    }).catch(this.error);
    this.homey.app._smartDetectionTriggerFace.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTriggerFace.trigger(this, {
      score,
      zones,
    }).catch(this.error);
  },

  // --------------------------------------------------------------------------
  // Audio detection trigger
  // --------------------------------------------------------------------------

  triggerAudioDetectionTrigger(audioType, readableType, score) {
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

    this.driver._deviceAudioDetectionTrigger.trigger(this, {
      audio_detection_type: mappedType,
      score,
    }, {
      audio_detection_type: mappedType,
    }).catch(this.error);
  },

};

module.exports = SmartDetectionMixin;



