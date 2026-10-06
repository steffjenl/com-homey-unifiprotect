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

  setSmartDetectionEvent(eventId, detectionTime, detectionTypes, detectionScore, kind = 'smart') {
    const event = new SmartDetectionEvent(detectionTime, detectionTypes, detectionScore, eventId, kind);
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

  _getZoneInfo(payload) {
    let zones = '';
    let zoneIds = [];
    if (payload && payload.metadata && payload.metadata.zonesStatus
      && typeof payload.metadata.zonesStatus === 'object') {
      let zoneNameMap = {};
      try {
        let smartDetectZones = null;
        if (this.homey.app.isV1Available()) {
          const bootstrap = this.homey.app.api.getBootstrap();
          const camera = bootstrap && bootstrap.cameras
            && bootstrap.cameras.find((c) => c.id === this.getData().id);
          if (camera && camera.smartDetectZones) {
            smartDetectZones = camera.smartDetectZones;
          }
        }
        if (!smartDetectZones && this._smartDetectZones) {
          smartDetectZones = this._smartDetectZones;
        }
        if (smartDetectZones) {
          zoneNameMap = smartDetectZones.reduce((map, zone) => {
            map[String(zone.id)] = zone.name;
            return map;
          }, {});
        }
      } catch (e) {
        this.homey.app.debug(`[SmartDetection] zone name lookup failed: ${e}`);
      }

      const activeZones = Object.entries(payload.metadata.zonesStatus)
        .filter(([, zone]) => zone && zone.status !== 'none');
      zoneIds = activeZones.map(([key]) => String(key));
      zones = activeZones.map(([key]) => zoneNameMap[key] || key).join(', ');
    }
    return { zones, zoneIds };
  },

  /**
   * Feed the per-zone motion sensors (protect-zone-sensor). Dispatched via the driver so the
   * mixin holds no device references.
   */
  _dispatchZoneSensors(eventId, event) {
    try {
      const driver = this.homey.drivers.getDriver('protect-zone-sensor');
      driver.onSmartDetectionUpdate(this.getData().id, eventId, event.detectionTypes, event.zoneIds);
    } catch (e) {
      this.homey.app.debug(`[SmartDetection] zone sensor dispatch failed: ${e}`);
    }
  },

  _notifyZoneSensorsEnded(eventId) {
    try {
      const driver = this.homey.drivers.getDriver('protect-zone-sensor');
      driver.onSmartDetectionEnded(this.getData().id, eventId);
    } catch (e) {
      this.homey.app.debug(`[SmartDetection] zone sensor end dispatch failed: ${e}`);
    }
  },

  /**
   * Smart detection closed by Protect (payload.end). Protect repeats the closing
   * frame two or three times, so fire the ended trigger once per event id.
   */
  onSmartDetectionEnd(payload, eventId) {
    const event = this.getSmartDetectionEvent(eventId);
    if (event === null || event.kind !== 'smart') {
      this.homey.app.debug(`[SmartDetection] end for unknown event [${eventId}] - ignoring`);
      return;
    }
    this._notifyZoneSensorsEnded(eventId);
    if (event.endedFired) {
      this.homey.app.debug(`[SmartDetection] duplicate end frame [${eventId}] - ignoring`);
      return;
    }
    // Event opened with smartDetectTypes: [] and never filled: no start trigger fired, so no ended either.
    if (!event.detectionTypes || event.detectionTypes.length === 0) {
      this.homey.app.debug(`[SmartDetection] end for event without types [${eventId}] - ignoring`);
      return;
    }
    event.endedFired = true;
    event.endTime = payload.end;

    // Plate type seen but its text never arrived: still fire the plate trigger once, with an empty token.
    if (event.detectionTypes.includes('licensePlate') && !event.triggered.has('licensePlate')) {
      event.triggered.add('licensePlate');
      this.triggerSmartDetectionTriggerLicensePlate(typeof event.detectionScore === 'number' ? event.detectionScore : 0, event.zones || '', '', event.zoneIds || [], event.direction || '');
    }

    const score = typeof event.detectionScore === 'number' ? event.detectionScore : 0;
    const duration = event.detectionTime ? Math.max(0, Math.round((event.endTime - event.detectionTime) / 1000)) : 0;
    this.homey.app.debug(`[SmartDetection] ended id=${eventId} types=${event.detectionTypes.join(',')} duration=${duration}`);
    this.triggerSmartDetectionEndedTrigger(event.detectionTypes.join(', '), score, event.zones || '', duration, event.zoneIds || [], event.direction || '');
  },

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
        this.homey.app.debug(`[SmartDetection] add: waiting for update [${eventId}]`);
        return;
      }
    } else if (actionType === 'update') {
      event = this.getSmartDetectionEvent(eventId);
      if (event === null) {
        this.homey.app.debug(`[SmartDetection] update for unknown event [${eventId}] - ignoring`);
        return;
      }
      // Protect repeats the closing frame, sometimes with an empty types array: never wipe known types.
      if (Array.isArray(payload.smartDetectTypes) && payload.smartDetectTypes.length > 0) {
        event.detectionTypes = payload.smartDetectTypes;
      }
      if (payload.score !== undefined) {
        event.detectionScore = payload.score;
      }
      if (payload.end) {
        this.onSmartDetectionEnd(payload, eventId);
        return;
      }
    } else {
      this.homey.app.debug(`[SmartDetection] unknown actionType: ${actionType}`);
      return;
    }

    this.homey.app.debug(`[SmartDetection] onSmartDetection id=${eventId} action=${actionType} types=${(event.detectionTypes || []).join(',')}`);

    if (!event.detectionTypes || event.detectionTypes.length === 0) {
      this.homey.app.debug(`[SmartDetection] still empty types [${eventId}] - skipping`);
      return;
    }

    const lastDetectionAt = event.detectionTime;
    const score = typeof event.detectionScore === 'number' ? event.detectionScore : 0;
    const smartDetectTypes = event.detectionTypes;

    // Zones can be reported on a later frame, and later frames may omit metadata: keep what we know.
    const zoneInfo = this._getZoneInfo(payload);
    if (zoneInfo.zoneIds.length > 0) {
      event.zones = zoneInfo.zones;
      event.zoneIds = zoneInfo.zoneIds;
    }
    const { zones } = event;
    const { zoneIds } = event;
    if (!event.endedFired) {
      this._dispatchZoneSensors(eventId, event);
    }

    // Plate text and direction can arrive on a later frame: remember them on the event.
    if (payload && payload.metadata && payload.metadata.licensePlate && payload.metadata.licensePlate.name) {
      event.licensePlate = payload.metadata.licensePlate.name;
    }
    if (payload && payload.metadata && typeof payload.metadata.direction === 'string' && payload.metadata.direction) {
      event.direction = payload.metadata.direction;
    }
    const licensePlateText = event.licensePlate;
    const { direction } = event;

    const lastDetection = this.homey.app.toLocalTime(new Date(lastDetectionAt));
    this.setCapabilityValue('last_smart_detection_at', lastDetectionAt).catch(this.error);
    this.setCapabilityValue('last_smart_detection_date', lastDetection.toLocaleDateString()).catch(this.error);
    this.setCapabilityValue('last_smart_detection_time', lastDetection.toLocaleTimeString()).catch(this.error);
    if (typeof score === 'number') {
      this.setCapabilityValue('last_smart_detection_score', score).catch(this.error);
    }

    if (smartDetectTypes.length > 0) {
      for (const type of smartDetectTypes) {
        // Only trigger each type once per detection event (eventId).
        if (event.triggered.has(type)) {
          continue;
        }
        // The plate text often arrives on a later frame: wait for it (onSmartDetectionEnd flushes if it never comes).
        if (type === 'licensePlate' && !licensePlateText) {
          continue;
        }
        event.triggered.add(type);
        this.homey.app.debug(`[SmartDetection] type=${type} device=${this.getData().id}`);
        if (type === 'person') {
          this.triggerSmartDetectionTriggerPerson(score, zones, zoneIds, direction);
        } else if (type === 'vehicle') {
          this.triggerSmartDetectionTriggerVehicle(score, zones, zoneIds, direction);
        } else if (type === 'animal') {
          this.triggerSmartDetectionTriggerAnimal(score, zones, zoneIds, direction);
        } else if (type === 'package') {
          this.triggerSmartDetectionTriggerPackage(score, zones, zoneIds, direction);
        } else if (type === 'licensePlate') {
          this.triggerSmartDetectionTriggerLicensePlate(score, zones, licensePlateText, zoneIds, direction);
        } else if (type === 'face') {
          this.triggerSmartDetectionTriggerFace(score, zones, zoneIds, direction);
        } else {
          this.homey.app.debug(`[SmartDetection] unknown type: ${type}`);
        }
      }
    } else {
      this.triggerSmartDetectionTriggerUnknown(score, zones, zoneIds, direction);
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
        'audio',
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

    this.homey.app.debug(`[AudioDetection] onAudioDetection id=${eventId} action=${actionType} types=${(event.detectionTypes || []).join(',')}`);

    const score = typeof event.detectionScore === 'number' ? event.detectionScore : 0;
    const audioDetectTypes = event.detectionTypes;

    if (audioDetectTypes && audioDetectTypes.length > 0) {
      for (const audioType of audioDetectTypes) {
        // Only trigger each audio type once per detection event (eventId).
        if (event.triggered.has(audioType)) {
          continue;
        }
        event.triggered.add(audioType);
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

  triggerSmartDetectionTriggerUnknown(score, zones, zoneIds = [], direction = '') {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'unknown',
      score,
      zones,
      direction,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'unknown',
      score,
      zones,
      direction,
    }, { zone_ids: zoneIds }).catch(this.error);
  },

  triggerSmartDetectionTriggerPerson(score, zones, zoneIds = [], direction = '') {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'person',
      score,
      zones,
      direction,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'person',
      score,
      zones,
      direction,
    }, { zone_ids: zoneIds }).catch(this.error);
    this.homey.app._smartDetectionTriggerPerson.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTriggerPerson.trigger(this, {
      score,
      zones,
    }, { zone_ids: zoneIds }).catch(this.error);
  },

  triggerSmartDetectionTriggerVehicle(score, zones, zoneIds = [], direction = '') {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'vehicle',
      score,
      zones,
      direction,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'vehicle',
      score,
      zones,
      direction,
    }, { zone_ids: zoneIds }).catch(this.error);
    this.homey.app._smartDetectionTriggerVehicle.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    // Fixed: camera incorrectly fired _deviceSmartDetectionTriggerAnimal for vehicles
    this.driver._deviceSmartDetectionTriggerVehicle.trigger(this, {
      score,
      zones,
    }, { zone_ids: zoneIds }).catch(this.error);
  },

  triggerSmartDetectionTriggerAnimal(score, zones, zoneIds = [], direction = '') {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'animal',
      score,
      zones,
      direction,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'animal',
      score,
      zones,
      direction,
    }, { zone_ids: zoneIds }).catch(this.error);
    this.homey.app._smartDetectionTriggerAnimal.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTriggerAnimal.trigger(this, {
      score,
      zones,
    }, { zone_ids: zoneIds }).catch(this.error);
  },

  triggerSmartDetectionTriggerPackage(score, zones, zoneIds = [], direction = '') {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'package',
      score,
      zones,
      direction,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'package',
      score,
      zones,
      direction,
    }, { zone_ids: zoneIds }).catch(this.error);
    this.homey.app._smartDetectionTriggerPackage.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTriggerPackage.trigger(this, {
      score,
      zones,
    }, { zone_ids: zoneIds }).catch(this.error);
  },

  triggerSmartDetectionTriggerLicensePlate(score, zones, licensePlate = '', zoneIds = [], direction = '') {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'licensePlate',
      score,
      zones,
      direction,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'licensePlate',
      score,
      zones,
      direction,
    }, { zone_ids: zoneIds }).catch(this.error);
    this.homey.app._smartDetectionTriggerLicensePlate.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
      license_plate: licensePlate,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTriggerLicensePlate.trigger(this, {
      score,
      zones,
      license_plate: licensePlate,
    }, { zone_ids: zoneIds }).catch(this.error);
  },

  triggerSmartDetectionTriggerFace(score, zones, zoneIds = [], direction = '') {
    this.homey.app._smartDetectionTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: 'face',
      score,
      zones,
      direction,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTrigger.trigger(this, {
      smart_detection_type: 'face',
      score,
      zones,
      direction,
    }, { zone_ids: zoneIds }).catch(this.error);
    this.homey.app._smartDetectionTriggerFace.trigger({
      ufp_smart_detection_camera: this.getName(),
      score,
      zones,
    }).catch(this.error);
    this.driver._deviceSmartDetectionTriggerFace.trigger(this, {
      score,
      zones,
    }, { zone_ids: zoneIds }).catch(this.error);
  },

  triggerSmartDetectionEndedTrigger(types, score, zones, duration, zoneIds = [], direction = '') {
    this.homey.app._smartDetectionEndedTrigger.trigger({
      ufp_smart_detection_camera: this.getName(),
      smart_detection_type: types,
      score,
      zones,
      duration,
      direction,
    }).catch(this.error);
    this.driver._deviceSmartDetectionEndedTrigger.trigger(this, {
      smart_detection_type: types,
      score,
      zones,
      duration,
      direction,
    }, { zone_ids: zoneIds }).catch(this.error);
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

    this.homey.app._audioDetectionTrigger.trigger({
      ufp_audio_detection_camera: this.getName(),
      audio_detection_type: mappedType,
      score,
    }).catch(this.error);

    this.driver._deviceAudioDetectionTrigger.trigger(this, {
      audio_detection_type: mappedType,
      score,
    }, {
      audio_detection_type: mappedType,
    }).catch(this.error);
  },

};

module.exports = SmartDetectionMixin;
