'use strict';

const BaseClass = require('./baseclass');
const UfvConstants = require('./constants');

class FobHandler extends BaseClass {
  constructor(options = {}) {
    super();
    this._dedupeWindowMs = Number(options.dedupeWindowMs) || 1500;
    this._recentEvents = new Map();
  }

  /**
   * Parse a v1 websocket packet into a normalized FOB button event.
   * Returns null when the packet is not a FOB button event or is a duplicate.
   * @param {object} updatePacket
   * @returns {object|null}
   */
  parseWebsocketPacket(updatePacket) {
    try {
      if (!updatePacket || !updatePacket.action || !updatePacket.payload) {
        return null;
      }

      if (updatePacket.action.modelKey !== 'event') {
        return null;
      }

      const payload = updatePacket.payload;
      if (payload.type !== 'sensorButtonPressed') {
        return null;
      }

      const metadata = payload.metadata || {};
      if (String(metadata.deviceModelKey || '').toLowerCase() !== 'fob') {
        return null;
      }

      const button = String(metadata.button && metadata.button.text || '').trim();
      const pressType = String(metadata.buttonPressType && metadata.buttonPressType.text || '').trim();
      const sensorName = String(metadata.sensorName && metadata.sensorName.text || '').trim();
      const timestamp = Number(payload.start || payload.end || Date.now());
      const deviceId = String(payload.device || metadata.sensorId && metadata.sensorId.text || updatePacket.action.id || '');

      if (!deviceId || !Number.isFinite(timestamp)) {
        return null;
      }

      if (!UfvConstants.FOB_BUTTONS.includes(button)) {
        this.homey.app.debug('[FobHandler] Unsupported button ignored: ' + button);
        return null;
      }

      if (!UfvConstants.FOB_PRESS_TYPES.includes(pressType)) {
        this.homey.app.debug('[FobHandler] Unsupported pressType ignored: ' + pressType);
        return null;
      }

      const event = {
        type: UfvConstants.FOB_EVENT_TYPE,
        deviceId,
        sensorName,
        button,
        pressType,
        timestamp,
      };

      if (this._isDuplicate(event)) {
        this.homey.app.debug('[FobHandler] Duplicate FOB event ignored: ' + JSON.stringify(event));
        return null;
      }

      this._remember(event);
      return event;
    } catch (error) {
      this.error(error);
      return null;
    }
  }

  _eventKey(event) {
    return [event.deviceId, event.button, event.pressType, event.timestamp].join('|');
  }

  _isDuplicate(event) {
    this._prune();
    return this._recentEvents.has(this._eventKey(event));
  }

  _remember(event) {
    this._prune();
    this._recentEvents.set(this._eventKey(event), Date.now());
  }

  _prune() {
    const now = Date.now();
    for (const [key, seenAt] of this._recentEvents.entries()) {
      if ((now - seenAt) > this._dedupeWindowMs) {
        this._recentEvents.delete(key);
      }
    }
  }
}

module.exports = FobHandler;


