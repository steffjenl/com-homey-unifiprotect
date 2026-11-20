'use strict';

const crypto = require('crypto');
const fs = require('fs');
const UfvConstants = require('./constants');

const SETTING_KEY = UfvConstants.SETTING_DEBUG_RECORDING;

// Keys whose value is a secret: removed entirely.
const SECRET_KEY_PATTERN = /(token|password|passwd|secret|cookie|csrf|authorization|apikey|api_key|accesskey|access_key|privatekey|private_key|credential|rtspalias|passphrase)/i;

// Keys whose value identifies a person, a network or a location: replaced by a stable hash.
const PII_KEY_PATTERN = new RegExp(`^(${[
  'mac', 'macs', '.*mac(address)?', 'host', 'hosts', 'ip', 'ips', '.*ipaddress', '.*ip_address', 'wanip', 'publicip', 'localip',
  'gateway', 'dns', 'email', '.*email', 'username', 'localusername', 'user_name', 'firstname', 'first_name', 'lastname',
  'last_name', 'fullname', 'full_name', 'displayname', 'display_name', '.*nfc.*', '.*fingerprint.*', 'cardid', 'card_id',
  'card_ids', 'pin', 'pincode', 'pin_code', 'phone', '.*phone.*', 'latitude', 'longitude', 'lat', 'lng', 'lon', 'ssid', 'bssid',
  'hardwareid', 'anonymousdeviceid', 'serial', 'serialnumber', '.*licenseplate.*',
].join('|')})$`, 'i');

// Keys never touched by the string-pattern pass (version strings can look like IPv4 addresses).
const VERSION_KEY_PATTERN = /(version|firmware)/i;

const IPV4_PATTERN = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const MAC_PATTERN = /\b[0-9a-f]{2}(?::[0-9a-f]{2}){5}\b/gi;
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const MAX_STRING_LENGTH = 10000;
const MAX_DEPTH = 30;
const FLUSH_DELAY_MS = 2000;

function hashValue(salt, value) {
  return `<redacted:${crypto.createHash('sha1').update(`${salt}:${String(value)}`).digest('hex').slice(0, 8)}>`;
}

function redactString(salt, value) {
  let result = value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…<truncated>` : value;
  result = result.replace(EMAIL_PATTERN, (m) => hashValue(salt, m));
  result = result.replace(MAC_PATTERN, (m) => hashValue(salt, m.toLowerCase()));
  result = result.replace(IPV4_PATTERN, (m) => hashValue(salt, m));
  return result;
}

/**
 * Returns a deep copy of `value` with secrets removed and personal/network data replaced by a
 * stable salted hash, so the same id still correlates across bootstrap and websocket messages.
 */
function redact(value, salt = '', key = '', depth = 0, parentKey = '', inPii = false) {
  if (value === null || typeof value === 'undefined') {
    return value;
  }
  if (depth > MAX_DEPTH) {
    return '<max-depth>';
  }
  if (key && SECRET_KEY_PATTERN.test(key)) {
    return '<removed>';
  }
  const isPii = inPii || (!!key && (PII_KEY_PATTERN.test(key) || (key === 'name' && /^(users|actor|user)$/i.test(parentKey))));

  if (Array.isArray(value)) {
    return value.map((item) => redact(item, salt, '', depth + 1, key || parentKey, isPii));
  }
  if (typeof value === 'object') {
    if (Buffer.isBuffer(value)) {
      return `<buffer:${value.length}>`;
    }
    const out = {};
    Object.keys(value).forEach((childKey) => {
      out[childKey] = redact(value[childKey], salt, childKey, depth + 1, key || parentKey, isPii);
    });
    return out;
  }
  if (isPii && (typeof value === 'string' || typeof value === 'number')) {
    return value === '' ? value : hashValue(salt, value);
  }
  if (typeof value === 'string') {
    return key && VERSION_KEY_PATTERN.test(key) ? value : redactString(salt, value);
  }
  return value;
}

/**
 * Records raw websocket messages (V1, V2 events, V2 devices, Access) to a JSONL file in
 * /userdata for a limited period, and builds a redacted debug snapshot for the settings page.
 */
class DebugRecorder {

  constructor(homey, options = {}) {
    this.homey = homey;
    this.filePath = options.filePath || UfvConstants.DEBUG_RECORDING_FILE;
    this.maxBytes = options.maxBytes || UfvConstants.DEBUG_RECORDING_MAX_BYTES;
    this.chunkBytes = options.chunkBytes || UfvConstants.DEBUG_RECORDING_CHUNK_BYTES;

    this._active = false;
    this._state = {};
    this._bytes = 0;
    this._messageCount = 0;
    this._buffer = [];
    this._flushTimer = null;
    this._stopTimer = null;
    this._flushing = null;
    this._downloadTokens = new Map();
  }

  async init() {
    this._state = this.homey.settings.get(SETTING_KEY) || {};
    if (!this._state.salt) {
      this._state.salt = crypto.randomBytes(8).toString('hex');
    }
    await this._loadFileStats();

    if (this._state.active && this._state.stopAt && this._state.stopAt > Date.now()) {
      this._active = true;
      this._scheduleStop(this._state.stopAt - Date.now());
      this._debug(`resumed recording until ${new Date(this._state.stopAt).toISOString()}`);
    } else if (this._state.active) {
      this._state.active = false;
      this._state.stopReason = 'expired';
      this._state.stoppedAt = this._state.stopAt || Date.now();
      this._persist();
    }
  }

  async start(hours) {
    const duration = Number(hours);
    if (!UfvConstants.DEBUG_RECORDING_DURATIONS.includes(duration)) {
      throw new Error(`Invalid recording duration: ${hours}`);
    }
    if (this._active) {
      await this.stop('restarted');
    }
    await this.flush();
    await fs.promises.writeFile(this.filePath, '');

    const now = Date.now();
    this._bytes = 0;
    this._messageCount = 0;
    this._buffer = [];
    this._active = true;
    this._state = {
      active: true,
      salt: crypto.randomBytes(8).toString('hex'),
      startedAt: now,
      stopAt: now + duration * 60 * 60 * 1000,
      hours: duration,
    };
    this._persist();
    this._scheduleStop(duration * 60 * 60 * 1000);
    this._debug(`started recording for ${duration}h`);
    return this.getStatus();
  }

  async stop(reason = 'manual') {
    if (this._stopTimer) {
      this.homey.clearTimeout(this._stopTimer);
      this._stopTimer = null;
    }
    if (this._active) {
      this._active = false;
      this._state.active = false;
      this._state.stoppedAt = Date.now();
      this._state.stopReason = reason;
      this._persist();
      this._debug(`stopped recording (${reason}), ${this._messageCount} messages, ${this._bytes} bytes`);
    }
    await this.flush();
    return this.getStatus();
  }

  async clear() {
    await this.stop('cleared');
    // Drop anything still buffered and zero the counters before touching the file, so a status
    // request that lands mid-clear never reports an inactive recording that still holds messages.
    this._buffer = [];
    this._bytes = 0;
    this._messageCount = 0;
    try {
      await fs.promises.unlink(this.filePath);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    this._bytes = 0;
    this._messageCount = 0;
    // Revoke every issued download link so cleared data can no longer be fetched
    this._downloadTokens.clear();
    return this.getStatus();
  }

  /**
   * Cleanup for app uninit: stop timers and write pending lines, but keep the persisted state
   * active so the recording resumes after an app restart.
   */
  async destroy() {
    if (this._stopTimer) {
      this.homey.clearTimeout(this._stopTimer);
      this._stopTimer = null;
    }
    this._active = false;
    await this.flush();
  }

  isActive() {
    return this._active;
  }

  getStatus() {
    return {
      active: this._active,
      startedAt: this._state.startedAt || null,
      stopAt: this._state.stopAt || null,
      stoppedAt: this._state.stoppedAt || null,
      stopReason: this._state.stopReason || null,
      bytes: this._bytes,
      maxBytes: this.maxBytes,
      messageCount: this._messageCount,
      durations: UfvConstants.DEBUG_RECORDING_DURATIONS,
    };
  }

  /**
   * Hot path, called from every websocket 'message' handler. No-op unless recording.
   * Never throws: a recording problem must not break event routing.
   */
  record(source, message) {
    if (!this._active) {
      return;
    }
    try {
      let msg = message;
      if (Buffer.isBuffer(msg)) {
        msg = msg.toString();
      }
      if (typeof msg === 'string') {
        try {
          msg = JSON.parse(msg);
        } catch {
          // keep the raw (redacted) string
        }
      }
      const line = `${JSON.stringify({ t: new Date().toISOString(), src: source, msg: redact(msg, this._state.salt) })}\n`;
      const lineBytes = Buffer.byteLength(line);

      if (this._bytes + lineBytes > this.maxBytes) {
        this.stop('size-limit').catch((error) => this.homey.error(error));
        return;
      }

      this._buffer.push(line);
      this._bytes += lineBytes;
      this._messageCount++;
      this._scheduleFlush();
    } catch (error) {
      this._debug(`record error: ${error.message}`);
    }
  }

  async flush() {
    if (this._flushTimer) {
      this.homey.clearTimeout(this._flushTimer);
      this._flushTimer = null;
    }
    while (this._flushing || this._buffer.length > 0) {
      if (this._flushing) {
        await this._flushing;
      } else {
        const data = this._buffer.join('');
        this._buffer = [];
        this._flushing = fs.promises.appendFile(this.filePath, data)
          .catch((error) => this.homey.error(error))
          .then(() => {
            this._flushing = null;
          });
      }
    }
  }

  /**
   * Reads one chunk of the recording, ending on a line boundary so every chunk holds whole
   * JSONL lines (and no split UTF-8 characters).
   */
  async readChunk(offset = 0) {
    await this.flush();
    const start = Math.max(0, parseInt(offset, 10) || 0);

    let handle;
    try {
      handle = await fs.promises.open(this.filePath, 'r');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          data: '', nextOffset: 0, total: 0, done: true,
        };
      }
      throw error;
    }
    try {
      const { size } = await handle.stat();
      if (start >= size) {
        return {
          data: '', nextOffset: size, total: size, done: true,
        };
      }
      const length = Math.min(this.chunkBytes, size - start);
      const buffer = Buffer.alloc(length);
      const { bytesRead } = await handle.read(buffer, 0, length, start);
      let end = bytesRead;
      if (start + bytesRead < size) {
        const lastNewline = buffer.lastIndexOf(0x0a, bytesRead - 1);
        if (lastNewline >= 0) end = lastNewline + 1;
      }
      const nextOffset = start + end;
      return {
        data: buffer.slice(0, end).toString('utf8'),
        nextOffset,
        total: size,
        done: nextOffset >= size,
      };
    } finally {
      await handle.close();
    }
  }

  /**
   * The settings page runs in a sandboxed iframe that cannot download files, so the export is
   * opened in a normal browser tab via a public endpoint, guarded by this short-lived token.
   */
  async createDownloadLink() {
    const now = Date.now();
    this._downloadTokens.forEach((entry, token) => {
      if (entry.expiresAt <= now) this._downloadTokens.delete(token);
    });

    const token = crypto.randomBytes(24).toString('hex');
    const expiresAt = now + UfvConstants.DEBUG_DOWNLOAD_TOKEN_TTL_MS;
    this._downloadTokens.set(token, { expiresAt, uses: 0 });

    const appId = this.homey.manifest.id;
    // App API responses cannot set Content-Disposition, so the path ends in a .json file name that
    // the browser proposes when the user saves the tab.
    // Not `?token=`: Homey's Web API treats that query parameter as its own bearer token (HTTP 401).
    const path = `/api/app/${appId}/debug-export/${this._exportFileName()}?code=${token}`;
    const [localAddress, homeyId] = await Promise.all([
      this.homey.cloud.getLocalAddress().catch(() => null),
      this.homey.cloud.getHomeyId().catch(() => null),
    ]);
    return {
      localUrl: localAddress ? `http://${localAddress}${path}` : null,
      cloudUrl: homeyId ? `https://${homeyId}.connect.athom.com${path}` : null,
      expiresAt,
    };
  }

  _exportFileName() {
    // Apps run in UTC; use the Homey's own timezone so the name matches the user's clock
    const { app } = this.homey;
    const d = app && typeof app.toLocalTime === 'function' ? app.toLocalTime(new Date()) : new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `unifiprotect-debug-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
      + `-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  }

  isValidDownloadToken(token) {
    if (typeof token !== 'string' || token.length === 0) return false;
    const now = Date.now();
    let valid = false;
    this._downloadTokens.forEach((entry, known) => {
      const a = Buffer.from(known);
      const b = Buffer.from(token);
      if (a.length === b.length && crypto.timingSafeEqual(a, b)
        && entry.expiresAt > now && entry.uses < UfvConstants.DEBUG_DOWNLOAD_TOKEN_MAX_USES) {
        entry.uses++;
        valid = true;
      }
    });
    return valid;
  }

  /** Snapshot plus all recorded websocket messages, as one object. */
  async buildExport() {
    const { snapshot, messages } = await this._buildExportParts();
    snapshot.websocketMessages = messages.split('\n').filter(Boolean).map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
    return snapshot;
  }

  async _buildExportParts() {
    const snapshot = await this.buildSnapshot();
    await this.flush();
    let messages = '';
    try {
      messages = await fs.promises.readFile(this.filePath, 'utf8');
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
    return { snapshot, messages };
  }

  async buildSnapshot() {
    const { app } = this.homey;
    const { salt } = this._state;
    const snapshot = {
      generatedAt: new Date().toISOString(),
      app: {
        id: this.homey.manifest && this.homey.manifest.id,
        version: this.homey.manifest && this.homey.manifest.version,
      },
      homey: {
        version: this.homey.version,
        platform: this.homey.platform,
        platformVersion: this.homey.platformVersion,
      },
      connection: this._safe(() => app.getConnectionStatus()),
      recording: this.getStatus(),
      homeyDevices: this._safe(() => this._listHomeyDevices()),
      protectV1: null,
      protectV2: null,
    };

    if (app.isV1Available && app.isV1Available()) {
      snapshot.protectV1 = { bootstrap: await this._getV1Bootstrap() };
    }

    if (app.isV2Available && app.isV2Available()) {
      const api = app.apiV2;
      const call = (fn) => fn().catch((error) => ({ error: error.message }));
      snapshot.protectV2 = {
        nvr: await call(() => api.getNVR()),
        cameras: await call(() => api.getCameras()),
        lights: await call(() => api.getLights()),
        sensors: await call(() => api.getSensors()),
        chimes: await call(() => api.getChimes()),
        relays: await call(() => api.getRelays()),
      };
    }

    return redact(snapshot, salt);
  }

  async _getV1Bootstrap() {
    const { api } = this.homey.app;
    try {
      // Fresh raw bootstrap: the cached one is compacted (events emptied, users trimmed).
      const raw = JSON.parse(await api.webclient.get('bootstrap'));
      if (raw && Array.isArray(raw.events) && raw.events.length > UfvConstants.DEBUG_BOOTSTRAP_MAX_EVENTS) {
        raw.events = raw.events.slice(-UfvConstants.DEBUG_BOOTSTRAP_MAX_EVENTS);
      }
      return raw;
    } catch (error) {
      this._debug(`fresh bootstrap failed, using cached: ${error.message}`);
      const cached = api.getBootstrap();
      return cached ? { cached: true, fetchError: error.message, ...cached } : { error: error.message };
    }
  }

  _listHomeyDevices() {
    const drivers = this.homey.drivers.getDrivers();
    return Object.keys(drivers).map((driverId) => ({
      driver: driverId,
      devices: drivers[driverId].getDevices().map((device) => ({
        id: device.getData().id,
        available: device.getAvailable(),
        capabilities: device.getCapabilities(),
        settings: device.getSettings(),
      })),
    }));
  }

  _safe(fn) {
    try {
      return fn();
    } catch (error) {
      return { error: error.message };
    }
  }

  async _loadFileStats() {
    try {
      const data = await fs.promises.readFile(this.filePath);
      this._bytes = data.length;
      let count = 0;
      for (let i = 0; i < data.length; i++) {
        if (data[i] === 0x0a) count++;
      }
      this._messageCount = count;
    } catch (error) {
      if (error.code !== 'ENOENT') this.homey.error(error);
      this._bytes = 0;
      this._messageCount = 0;
    }
  }

  _scheduleFlush() {
    if (this._flushTimer) return;
    this._flushTimer = this.homey.setTimeout(() => {
      this._flushTimer = null;
      this.flush().catch((error) => this.homey.error(error));
    }, FLUSH_DELAY_MS);
  }

  _scheduleStop(ms) {
    if (this._stopTimer) {
      this.homey.clearTimeout(this._stopTimer);
    }
    this._stopTimer = this.homey.setTimeout(() => {
      this._stopTimer = null;
      this.stop('duration-elapsed').catch((error) => this.homey.error(error));
    }, Math.max(0, ms));
  }

  _persist() {
    try {
      this.homey.settings.set(SETTING_KEY, this._state);
    } catch (error) {
      this.homey.error(error);
    }
  }

  _debug(message) {
    if (this.homey.app && typeof this.homey.app.debug === 'function') {
      Promise.resolve(this.homey.app.debug(`[DebugRecorder] ${message}`)).catch(() => {});
    }
  }

}

module.exports = DebugRecorder;
module.exports.redact = redact;
