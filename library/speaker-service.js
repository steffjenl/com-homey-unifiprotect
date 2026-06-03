'use strict';

const BaseClass = require('./baseclass');

class SpeakerService extends BaseClass {
  constructor(options = {}) {
    super();
    this._defaultVolume = Number(options.defaultVolume) || 70;
    this._defaultRepeat = Number(options.defaultRepeat) || 1;

    // Optional transport hooks. Keep integration abstract.
    this._sendSpeakerMessageImpl = options.sendSpeakerMessageImpl;
    this._listSpeakersImpl = options.listSpeakersImpl;
  }

  /**
   * Broadcast a TTS/audio message to available Protect speakers.
   * @param {string} message
   * @param {{volume?: number, repeat?: number}} options
   * @returns {Promise<boolean>}
   */
  async sendSpeakerMessage(message, options = {}) {
    const text = String(message || '').trim();
    if (!text) {
      return false;
    }

    const sendOptions = {
      volume: this._normalizeVolume(options.volume),
      repeat: this._normalizeRepeat(options.repeat),
    };

    const speakers = await this._getSpeakers();
    if (speakers.length === 0) {
      this.homey.app.debug('[SpeakerService] No speaker devices found. Message not sent: ' + text);
      return false;
    }

    await Promise.all(speakers.map((speaker) => this._sendToSpeaker(speaker, text, sendOptions)));
    return true;
  }

  _normalizeVolume(value) {
    const volume = Number.isFinite(Number(value)) ? Number(value) : this._defaultVolume;
    return Math.max(0, Math.min(100, Math.round(volume)));
  }

  _normalizeRepeat(value) {
    const repeat = Number.isFinite(Number(value)) ? Number(value) : this._defaultRepeat;
    return Math.max(1, Math.min(10, Math.round(repeat)));
  }

  async _getSpeakers() {
    if (typeof this._listSpeakersImpl === 'function') {
      try {
        const externalSpeakers = await this._listSpeakersImpl();
        if (Array.isArray(externalSpeakers)) {
          return externalSpeakers;
        }
      } catch (error) {
        this.error(error);
      }
    }

    const bootstrap = this.homey.app.api.getBootstrap();
    if (!bootstrap || !Array.isArray(bootstrap.speakers)) {
      return [];
    }

    return bootstrap.speakers;
  }

  async _sendToSpeaker(speaker, message, options) {
    if (typeof this._sendSpeakerMessageImpl === 'function') {
      await this._sendSpeakerMessageImpl(speaker, message, options);
      return;
    }

    // Abstract fallback: log intent when no transport is configured.
    const speakerId = speaker && speaker.id ? String(speaker.id) : 'unknown';
    this.homey.app.debug('[SpeakerService] send speaker message (abstract) speaker=' + speakerId + ' message=' + message + ' options=' + JSON.stringify(options));
  }
}

module.exports = SpeakerService;

