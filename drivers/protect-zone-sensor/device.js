'use strict';

const Homey = require('homey');

// Safety net: Protect should always close a detection, but if the closing frame is lost
// (WebSocket drop) the sensor must not stay on forever.
const STALE_EVENT_MS = 15 * 60 * 1000;

class ZoneSensorDevice extends Homey.Device {

  async onInit() {
    // Open smart detection event ids currently inside this zone -> stale timer
    this._openEvents = new Map();
    await this._createMissingCapabilities();
    await this.setCapabilityValue('alarm_motion', false).catch(this.error);
    this.homey.app.debug(`[ZoneSensorDevice] initialized ${this.getData().id}`);
  }

  async _createMissingCapabilities() {
    if (!this.hasCapability('alarm_motion')) {
      await this.addCapability('alarm_motion').catch(this.error);
    }
  }

  _isTypeEnabled(type) {
    const value = this.getSetting(`ufp:type_${type}`);
    return value === true;
  }

  /**
   * A smart detection is open (or changed). Counts as motion while it is in this zone and one
   * of its types is enabled in the settings.
   */
  onZoneDetection(eventId, types, zoneIds) {
    const zoneId = String(this.getData().zoneId);
    const inZone = (zoneIds || []).map(String).includes(zoneId);
    const typeMatches = (types || []).some((type) => this._isTypeEnabled(type));

    if (inZone && typeMatches) {
      this._clearTimer(eventId);
      this._openEvents.set(eventId, this.homey.setTimeout(() => this.onZoneDetectionEnded(eventId), STALE_EVENT_MS));
    } else {
      this._closeEvent(eventId);
    }
    this._updateMotion();
  }

  onZoneDetectionEnded(eventId) {
    this._closeEvent(eventId);
    this._updateMotion();
  }

  _clearTimer(eventId) {
    if (this._openEvents.has(eventId)) {
      this.homey.clearTimeout(this._openEvents.get(eventId));
    }
  }

  _closeEvent(eventId) {
    this._clearTimer(eventId);
    this._openEvents.delete(eventId);
  }

  _updateMotion() {
    const active = this._openEvents.size > 0;
    if (this.getCapabilityValue('alarm_motion') !== active) {
      this.homey.app.debug(`[ZoneSensorDevice] ${this.getData().id} alarm_motion=${active}`);
      this.setCapabilityValue('alarm_motion', active).catch(this.error);
    }
  }

  _clearAll() {
    if (!this._openEvents) return;
    for (const timer of this._openEvents.values()) {
      this.homey.clearTimeout(timer);
    }
    this._openEvents.clear();
  }

  async onDeleted() {
    this._clearAll();
  }

  async onUninit() {
    this._clearAll();
  }

}

module.exports = ZoneSensorDevice;
