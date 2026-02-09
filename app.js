// eslint-disable-next-line node/no-unpublished-require,strict

'use strict';

const Homey = require('homey');
const {Log} = require('homey-log');
const ProtectAPI = require('./library/protectapi');
const AppAccess = require('./library/app-access');
const AppProtect = require('./library/app-protect');
const AccessAPI = require('./library/access-api-v2/access-api');
const ProtectAPIV2 = require('./library/protect-api-v2/protect-api');
const { stat, existsSync, unlinkSync, writeFile } = require("fs");

// Constants
const DEFAULT_IGNORE_EVENTS_NFC_FINGERPRINT_SECONDS = 5;
const DEFAULT_IGNORE_EVENTS_DOORBELL_SECONDS = 5;
const AUTH_TOKEN_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
const MAX_LOG_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25MB
const LOG_FILE_PATH = '/userdata/application-log.log';

// Settings keys
const SETTINGS_KEY_CREDENTIALS = 'ufp:credentials';
const SETTINGS_KEY_NVR_IP = 'ufp:nvrip';
const SETTINGS_KEY_NVR_PORT = 'ufp:nvrport';
const SETTINGS_KEY_SETTINGS = 'ufp:settings';
const SETTINGS_KEY_TOKENS = 'ufp:tokens';

/**
 * UniFi Protect Homey Application
 * 
 * Main application class that manages the integration between Homey and UniFi Protect/Access systems.
 * Handles API initialization, authentication, websocket connections, and device management.
 * 
 * @class UniFiProtect
 * @extends {Homey.App}
 */
class UniFiProtect extends Homey.App {
    
    /**
     * Initialize the UniFi Protect application.
     * 
     * Sets up API instances, initializes authentication, registers event listeners,
     * and configures widget autocomplete handlers.
     * 
     * @async
     * @returns {Promise<void>}
     */
    async onInit() {
        // Initialize logging
        this.homeyLog = new Log({homey: this.homey});
        
        // Initialize authentication state
        this._initializeAuthenticationState();
        
        // Initialize API instances
        this._initializeAPIInstances();
        
        // Initialize sub-applications
        await this._initializeSubApplications();
        
        // Register snapshot token
        this.appProtect._registerSnapshotToken();
        
        // Setup settings listeners
        this._setupSettingsListeners();
        
        // Load and apply settings
        this._loadAndApplySettings();
        
        // Perform initial login
        this.appProtect._appLogin();
        
        // Setup auth token refresh
        await this.appProtect.refreshAuthTokens();
        
        // Register widget autocomplete handlers
        this._registerWidgetHandlers();
        
        this.debug('UniFiProtect has been initialized');
    }
    
    /**
     * Initialize authentication-related state variables.
     * @private
     */
    _initializeAuthenticationState() {
        this.debuggedIn = false;
        this.nvrIp = null;
        this.nvrPort = null;
        this.nvrUsername = null;
        this.nvrPassword = null;
        this.useCameraSnapshot = false;
        this.ignoreEventsNfcFingerprint = DEFAULT_IGNORE_EVENTS_NFC_FINGERPRINT_SECONDS;
        this.ignoreEventsDoorbell = DEFAULT_IGNORE_EVENTS_DOORBELL_SECONDS;
        this._refreshAuthTokensInterval = AUTH_TOKEN_REFRESH_INTERVAL_MS;
        this.lastDoorAccessEvent = null;
    }
    
    /**
     * Initialize all API instances and set Homey object context.
     * @private
     */
    _initializeAPIInstances() {
        // Initialize Protect API instances
        this.api = new ProtectAPI();
        this.api.setHomeyObject(this.homey);
        
        this.apiV2 = new ProtectAPIV2();
        this.apiV2.setHomeyObject(this.homey);
        
        this.appProtect = new AppProtect();
        this.appProtect.setHomeyObject(this.homey);
        
        // Initialize Access API instances
        this.accessApi = new AccessAPI();
        this.accessApi.setHomeyObject(this.homey);
        
        this.appAccess = new AppAccess();
        this.appAccess.setHomeyObject(this.homey);
    }
    
    /**
     * Initialize sub-application modules.
     * @async
     * @private
     * @returns {Promise<void>}
     */
    async _initializeSubApplications() {
        await this.appProtect.onInit();
        await this.appAccess.onInit();
    }
    
    /**
     * Setup event listeners for settings changes.
     * @private
     */
    _setupSettingsListeners() {
        this.homey.settings.on('set', (key) => {
            if (this._isCredentialsKey(key)) {
                this._handleCredentialsChange();
            }
            if (key === SETTINGS_KEY_SETTINGS) {
                this._handleSettingsChange();
            }
            if (key === SETTINGS_KEY_TOKENS) {
                this._handleTokensChange();
            }
        });
    }
    
    /**
     * Check if the key is a credentials-related setting.
     * @private
     * @param {string} key - The settings key
     * @returns {boolean} True if the key is credentials-related
     */
    _isCredentialsKey(key) {
        return key === SETTINGS_KEY_CREDENTIALS || 
               key === SETTINGS_KEY_NVR_IP || 
               key === SETTINGS_KEY_NVR_PORT;
    }
    
    /**
     * Handle credentials change event.
     * @private
     */
    _handleCredentialsChange() {
        this.appProtect._appLogin();
    }
    
    /**
     * Handle settings change event.
     * @private
     */
    _handleSettingsChange() {
        const settings = this.homey.settings.get(SETTINGS_KEY_SETTINGS);
        if (settings) {
            this.useCameraSnapshot = settings.useCameraSnapshot;
            this.ignoreEventsNfcFingerprint = settings.ignoreEventsNfcFingerprint || DEFAULT_IGNORE_EVENTS_NFC_FINGERPRINT_SECONDS;
            this.ignoreEventsDoorbell = settings.ignoreEventsDoorbell || DEFAULT_IGNORE_EVENTS_DOORBELL_SECONDS;
        }
    }
    
    /**
     * Handle tokens change event and attempt login.
     * @private
     */
    _handleTokensChange() {
        const tokens = this.homey.settings.get(SETTINGS_KEY_TOKENS);
        if (!tokens) return;
        
        this.accessApiKey = tokens.accessApiKey;
        this.protectV2ApiKey = tokens.protectV2ApiKey;
        
        if (this._isValidApiKey(tokens.accessApiKey)) {
            this.appAccess.loginToAccess().catch(this.error);
        }
        
        if (this._isValidApiKey(tokens.protectV2ApiKey)) {
            this.appProtect.loginToProtectV2().catch(this.error);
        }
    }
    
    /**
     * Check if an API key is valid (defined and not empty).
     * @private
     * @param {string|undefined} apiKey - The API key to validate
     * @returns {boolean} True if the API key is valid
     */
    _isValidApiKey(apiKey) {
        return typeof apiKey !== 'undefined' && apiKey !== '';
    }
    
    /**
     * Load and apply settings from storage.
     * @private
     */
    _loadAndApplySettings() {
        // Load general settings
        const settings = this.homey.settings.get(SETTINGS_KEY_SETTINGS);
        if (settings) {
            this.useCameraSnapshot = settings.useCameraSnapshot;
            this.ignoreEventsNfcFingerprint = settings.ignoreEventsNfcFingerprint || DEFAULT_IGNORE_EVENTS_NFC_FINGERPRINT_SECONDS;
            this.ignoreEventsDoorbell = settings.ignoreEventsDoorbell || DEFAULT_IGNORE_EVENTS_DOORBELL_SECONDS;
        }
        
        // Load and apply tokens
        const tokens = this.homey.settings.get(SETTINGS_KEY_TOKENS);
        if (tokens) {
            this.accessApiKey = tokens.accessApiKey;
            this.protectV2ApiKey = tokens.protectV2ApiKey;
            
            if (this._isValidApiKey(tokens.accessApiKey)) {
                this.appAccess.loginToAccess().catch(this.error);
            }
            
            if (this._isValidApiKey(tokens.protectV2ApiKey)) {
                this.appProtect.loginToProtectV2().catch(this.error);
            }
        }
    }
    
    /**
     * Register autocomplete handlers for dashboard widgets.
     * @private
     */
    _registerWidgetHandlers() {
        this._registerCameraWidgetHandler();
        this._registerDoorbellWidgetHandler();
    }
    
    /**
     * Register autocomplete handler for camera widget.
     * @private
     */
    _registerCameraWidgetHandler() {
        const cameraWidget = this.homey.dashboards.getWidget('camera');
        cameraWidget.registerSettingAutocompleteListener('device', async (query, settings) => {
            return this._getDevicesForWidget('protectcamera');
        });
    }
    
    /**
     * Register autocomplete handler for doorbell widget.
     * @private
     */
    _registerDoorbellWidgetHandler() {
        const doorbellWidget = this.homey.dashboards.getWidget('doorbell');
        doorbellWidget.registerSettingAutocompleteListener('device', async (query, settings) => {
            return this._getDevicesForWidget('protectdoorbell');
        });
    }
    
    /**
     * Get devices for widget autocomplete.
     * @private
     * @async
     * @param {string} driverId - The driver ID to get devices from
     * @returns {Promise<Array<{name: string, id: string, driverId: string}>>} Array of device objects
     */
    async _getDevicesForWidget(driverId) {
        const devices = await this.homey.drivers.getDriver(driverId).getDevices();
        return devices.map((device) => ({
            name: device.getName(),
            id: device.getData().id,
            driverId: driverId
        }));
    }

    /**
     * Convert a Homey time to local timezone time.
     * 
     * @param {Date} homeyTime - The Homey timestamp to convert
     * @returns {Date} The local time in the configured timezone
     */
    toLocalTime(homeyTime) {
        const timezone = this.homey.clock.getTimezone();
        const localTime = new Date(homeyTime.toLocaleString('en-US', {timeZone: timezone}));
        return localTime;
    }

    /**
     * Get the current Unix timestamp in milliseconds.
     * 
     * @returns {number} Current timestamp in milliseconds
     */
    getUnixTimestamp() {
        return Math.floor(Date.now());
    }

    /**
     * Parse and handle incoming websocket messages.
     * 
     * @param {Object} payload - The websocket message payload
     * @param {string} [payload.type] - The message type
     */
    onParseWebsocketMessage(payload) {
        if (!payload || !payload.hasOwnProperty('type')) {
            return;
        }

        if (payload.type === 'doorAccess') {
            this.appAccess.onDoorAccess(payload);
        }
    }

    /**
     * Debug logging utility with optional persistent storage.
     * 
     * Logs debug messages to the console when DEBUG mode is enabled,
     * and optionally writes to a persistent log file if configured.
     * Automatically manages log file size to prevent excessive disk usage.
     * 
     * @async
     * @param {...*} args - Arguments to log
     * @returns {Promise<void>}
     */
    async debug(...args) {
        // Console logging in debug mode
        if (Homey.env.DEBUG === 'true') {
            this._logToConsole('[debug]', ...args);
            this._cleanupLogFileIfExists();
        }
        
        // Persistent file logging
        const settings = this.homey.settings.get(SETTINGS_KEY_SETTINGS);
        if (settings && settings.saveLogToPersistentStorage) {
            await this._logToFile('[debug]', ...args);
        }
    }
    
    /**
     * Log message to console.
     * @private
     * @param {string} prefix - Log prefix
     * @param {...*} args - Arguments to log
     */
    _logToConsole(prefix, ...args) {
        this.homey.log(prefix, ...args);
    }
    
    /**
     * Clean up log file if it exists in debug mode.
     * @private
     */
    _cleanupLogFileIfExists() {
        if (existsSync(LOG_FILE_PATH)) {
            unlinkSync(LOG_FILE_PATH);
        }
    }
    
    /**
     * Log message to persistent file with size management.
     * @private
     * @async
     * @param {string} prefix - Log prefix
     * @param {...*} args - Arguments to log
     * @returns {Promise<void>}
     */
    async _logToFile(prefix, ...args) {
        try {
            // Check file size and cleanup if needed
            await this._managementLogFileSize();
            
            // Write log entry
            const logMessage = [prefix, ...args].join(' ') + '\n';
            await this._appendToLogFile(logMessage);
        } catch (error) {
            this.error('Failed to write to log file:', error);
        }
    }
    
    /**
     * Check log file size and delete if it exceeds the maximum.
     * @private
     * @async
     * @returns {Promise<void>}
     */
    async _managementLogFileSize() {
        return new Promise((resolve) => {
            stat(LOG_FILE_PATH, (err, stats) => {
                if (!err && stats.size >= MAX_LOG_FILE_SIZE_BYTES) {
                    unlinkSync(LOG_FILE_PATH);
                }
                resolve();
            });
        });
    }
    
    /**
     * Append message to log file.
     * @private
     * @async
     * @param {string} message - Message to append
     * @returns {Promise<void>}
     */
    async _appendToLogFile(message) {
        return new Promise((resolve, reject) => {
            writeFile(LOG_FILE_PATH, message, { flag: 'a+' }, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

module.exports = UniFiProtect;
