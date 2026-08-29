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
      if (apiType === 'v2' && this.homey.app.apiV2) {
        this.homey.app.apiV2.on('protectv2-connection-error', this._onConnectionError.bind(this, 'v2'));
        this.homey.app.apiV2.on('protectv2-connection-change', this._onConnectionChange.bind(this, 'v2'));
      } else if (apiType === 'v1' && this.homey.app.api) {
        this.homey.app.api.on('protectv1-connection-error', this._onConnectionError.bind(this, 'v1'));
        this.homey.app.api.on('protectv1-connection-change', this._onConnectionChange.bind(this, 'v1'));
      } else if (apiType === 'access' && this.homey.app.accessApi) {
        this.homey.app.accessApi.on('access-connection-error', this._onConnectionError.bind(this, 'access'));
        this.homey.app.accessApi.on('access-connection-change', this._onConnectionChange.bind(this, 'access'));
      }
    } catch (error) {
      this.error('[ConnectionMonitor] Failed to start monitoring:', error);
    }
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
    
    if (apiType === 'v2' && this.homey.app.apiV2) {
      this.homey.app.apiV2.removeAllListeners('protectv2-connection-error');
      this.homey.app.apiV2.removeAllListeners('protectv2-connection-change');
    } else if (apiType === 'v1' && this.homey.app.api) {
      this.homey.app.api.removeAllListeners('protectv1-connection-error');
      this.homey.app.api.removeAllListeners('protectv1-connection-change');
    } else if (apiType === 'access' && this.homey.app.accessApi) {
      this.homey.app.accessApi.removeAllListeners('access-connection-error');
      this.homey.app.accessApi.removeAllListeners('access-connection-change');
    }
  },
};

module.exports = ConnectionMonitorMixin;
