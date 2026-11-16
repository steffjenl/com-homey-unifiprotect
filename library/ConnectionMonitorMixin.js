'use strict';

/**
 * ConnectionMonitorMixin - Mixin for device classes to monitor controller connectivity
 *
 * Provides debounced unavailability tracking when the controller becomes unreachable.
 * Devices using this mixin should call _startConnectionMonitoring() in their onInit() method.
 *
 * Usage:
 *   class MyDevice extends Homey.Device {
 *     onInit() {
 *       this._startConnectionMonitoring('v2'); // or 'v1' or 'access'
 *     }
 *   }
 *   Object.assign(MyDevice.prototype, ConnectionMonitorMixin);
 */

const ConnectionMonitorMixin = {
  _connectionErrorTimestamp: null,
  _connectionErrorTimeout: null,
  _unavailableMarkTimeout: null,
  _connectionMonitorDebounceMs: 20000, // 20 seconds

  /**
   * Start monitoring the specified API connection for errors
   * @param {string} apiType - 'v2', 'v1', or 'access'
   */
  _startConnectionMonitoring(apiType) {
    try {
      const sources = {
        v2: { emitter: this.homey.app.apiV2, prefix: 'protectv2' },
        v1: { emitter: this.homey.app.api, prefix: 'protectv1' },
        access: { emitter: this.homey.app.accessApi, prefix: 'access' },
      };
      const source = sources[apiType];
      if (!source || !source.emitter) {
        return;
      }

      // Never register twice for the same device.
      this._removeConnectionMonitorHandlers();

      // Keep the bound handlers so only this device's listeners are removed later.
      const handlers = {
        emitter: source.emitter,
        errorEvent: `${source.prefix}-connection-error`,
        changeEvent: `${source.prefix}-connection-change`,
        onError: this._onConnectionError.bind(this, apiType),
        onChange: this._onConnectionChange.bind(this, apiType),
      };
      handlers.emitter.on(handlers.errorEvent, handlers.onError);
      handlers.emitter.on(handlers.changeEvent, handlers.onChange);
      this._connectionMonitorHandlers = handlers;
    } catch (error) {
      this.error('[ConnectionMonitor] Failed to start monitoring:', error);
    }
  },

  /**
   * Remove this device's own listeners from the API emitter
   * @private
   */
  _removeConnectionMonitorHandlers() {
    const handlers = this._connectionMonitorHandlers;
    if (!handlers) {
      return;
    }
    handlers.emitter.removeListener(handlers.errorEvent, handlers.onError);
    handlers.emitter.removeListener(handlers.changeEvent, handlers.onChange);
    this._connectionMonitorHandlers = null;
  },

  /**
   * Handle connection errors from the API layer
   * @private
   */
  _onConnectionError(apiType, details) {
    this._connectionErrorTimestamp = Date.now();

    // Clear any pending unavailable mark timeout
    if (this._unavailableMarkTimeout) {
      this.homey.clearTimeout(this._unavailableMarkTimeout);
      this._unavailableMarkTimeout = null;
    }

    // Schedule marking device as unavailable after debounce period
    this._unavailableMarkTimeout = this.homey.setTimeout(() => {
      this._markUnavailable(apiType, details);
    }, this._connectionMonitorDebounceMs);
  },

  /**
   * Handle connection state changes from the API layer
   * @private
   */
  _onConnectionChange(apiType, details) {
    if (details.state === 'connected') {
      // Connection restored
      if (this._unavailableMarkTimeout) {
        this.homey.clearTimeout(this._unavailableMarkTimeout);
        this._unavailableMarkTimeout = null;
      }

      this._connectionErrorTimestamp = null;

      // Restore device availability
      try {
        this.setAvailable();
      } catch (error) {
        this.homey.app.debug('[ConnectionMonitor] Error restoring availability:', error);
      }
    } else if (details.state === 'disconnected') {
      // Connection lost - schedule marking unavailable after debounce
      this._connectionErrorTimestamp = Date.now();

      if (this._unavailableMarkTimeout) {
        this.homey.clearTimeout(this._unavailableMarkTimeout);
      }

      this._unavailableMarkTimeout = this.homey.setTimeout(() => {
        this._markUnavailable(apiType, details);
      }, this._connectionMonitorDebounceMs);
    }
  },

  /**
   * Mark device as unavailable with a message
   * @private
   */
  _markUnavailable(apiType, details) {
    try {
      const msg = this.homey.__('msg.controller_unreachable');
      this.setUnavailable(msg);
      this.homey.app.debug(`[ConnectionMonitor] Device marked unavailable (${apiType})`);
    } catch (error) {
      this.homey.app.debug('[ConnectionMonitor] Error marking unavailable:', error);
    }
  },

  /**
   * Stop monitoring connection (call in onDeleted if needed)
   */
  _stopConnectionMonitoring(apiType) {
    if (this._unavailableMarkTimeout) {
      this.homey.clearTimeout(this._unavailableMarkTimeout);
      this._unavailableMarkTimeout = null;
    }

    if (this._connectionErrorTimeout) {
      this.homey.clearTimeout(this._connectionErrorTimeout);
      this._connectionErrorTimeout = null;
    }

    // Only this device's listeners: other devices and AppProtect share the same emitter.
    this._removeConnectionMonitorHandlers();
  },
};

module.exports = ConnectionMonitorMixin;
