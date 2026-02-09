'use strict';

const https = require('https');
const ProtectWebClient = require('./library/webclient');

// Constants
const SETTINGS_KEY_TOKENS = 'ufp:tokens';
const CONNECTION_STATUS_CONNECTED = 'Connected';
const CONNECTION_STATUS_UNKNOWN = 'Unknown';
const CONNECTION_STATUS_NO_KEY = 'No API Key found';
const HTTP_STATUS_OK = 200;
const HTTP_STATUS_UNAUTHORIZED = 401;
const HTTP_STATUS_FORBIDDEN = 403;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const CREDENTIAL_TEST_TIMEOUT_MS = 2000;

/**
 * Homey API endpoints for UniFi Protect integration.
 * 
 * This module exports API methods that can be called from the Homey settings interface
 * to check connection status, test credentials, and retrieve websocket information.
 * 
 * @module api
 */

/**
 * Helper function to check if an API key is valid.
 * @private
 * @param {string|undefined} apiKey - The API key to validate
 * @returns {boolean} True if the API key is valid (defined and not empty)
 */
function isValidApiKey(apiKey) {
    return typeof apiKey !== 'undefined' && apiKey !== '';
}

/**
 * Get the websocket connection status for a given API.
 * @private
 * @param {Object} websocket - The websocket instance
 * @returns {string} Connection status ('Connected' or 'Unknown')
 */
function getWebsocketConnectionStatus(websocket) {
    return websocket.isWebsocketConnected() ? CONNECTION_STATUS_CONNECTED : CONNECTION_STATUS_UNKNOWN;
}

module.exports = {
    /**
     * Get the current login status of the Protect API.
     * 
     * @async
     * @param {Object} context - The API context
     * @param {Object} context.homey - Homey instance
     * @param {Object} context.query - Query parameters
     * @returns {Promise<number|string>} The current login status
     */
    async getStatus({homey, query}) {
        return homey.app.api.loggedInStatus;
    },
    
    /**
     * Get the websocket connection status for the main Protect API.
     * 
     * @async
     * @param {Object} context - The API context
     * @param {Object} context.homey - Homey instance
     * @param {Object} context.query - Query parameters
     * @returns {Promise<string>} 'Connected' or 'Unknown'
     */
    async getWebsocketStatus({homey, query}) {
        return getWebsocketConnectionStatus(homey.app.api.ws);
    },
    
    /**
     * Get the timestamp of the last websocket message received.
     * 
     * @async
     * @param {Object} context - The API context
     * @param {Object} context.homey - Homey instance
     * @param {Object} context.query - Query parameters
     * @returns {Promise<number|null>} Timestamp of last message or null
     */
    async getLastWebsocketMessageTime({homey, query}) {
        return homey.app.api.ws.getLastWebsocketMessageTime();
    },
    
    /**
     * Get the websocket connection status for the Access API.
     * 
     * @async
     * @param {Object} context - The API context
     * @param {Object} context.homey - Homey instance
     * @param {Object} context.query - Query parameters
     * @returns {Promise<string>} 'Connected', 'Unknown', or 'No API Key found'
     */
    async getAccessWebsocketStatus({homey, query}) {
        const tokens = homey.settings.get(SETTINGS_KEY_TOKENS);
        
        if (tokens && isValidApiKey(tokens.accessApiKey)) {
            return getWebsocketConnectionStatus(homey.app.accessApi.websocket);
        }
        
        return CONNECTION_STATUS_NO_KEY;
    },
    
    /**
     * Get the timestamp of the last Access API websocket message.
     * 
     * @async
     * @param {Object} context - The API context
     * @param {Object} context.homey - Homey instance
     * @param {Object} context.query - Query parameters
     * @returns {Promise<number|null>} Timestamp of last message or null
     */
    async getLastAccessWebsocketMessageTime({homey, query}) {
        return homey.app.accessApi.websocket.getLastWebsocketMessageTime();
    },
    
    /**
     * Get the websocket connection status for the Protect V2 API.
     * 
     * @async
     * @param {Object} context - The API context
     * @param {Object} context.homey - Homey instance
     * @param {Object} context.query - Query parameters
     * @returns {Promise<string>} 'Connected', 'Unknown', or 'No API Key found'
     */
    async getProtectV2WebsocketStatus({homey, query}) {
        const tokens = homey.settings.get(SETTINGS_KEY_TOKENS);
        
        if (tokens && isValidApiKey(tokens.protectV2ApiKey)) {
            return getWebsocketConnectionStatus(homey.app.apiV2.websocket);
        }
        
        return CONNECTION_STATUS_NO_KEY;
    },
    
    /**
     * Get the timestamp of the last Protect V2 API websocket message.
     * 
     * @async
     * @param {Object} context - The API context
     * @param {Object} context.homey - Homey instance
     * @param {Object} context.query - Query parameters
     * @returns {Promise<number|null>} Timestamp of last message or null
     */
    async getLastProtectV2WebsocketMessageTime({homey, query}) {
        return homey.app.apiV2.websocket.getLastWebsocketMessageTime();
    },
    
    /**
     * Test UniFi Protect credentials by attempting to authenticate.
     * 
     * Performs a login request to validate the provided credentials
     * without actually logging in the app.
     * 
     * @async
     * @param {Object} context - The API context
     * @param {Object} context.homey - Homey instance
     * @param {Object} context.body - Request body
     * @param {string} context.body.host - UniFi Protect host
     * @param {number} context.body.port - UniFi Protect port
     * @param {string} context.body.user - Username
     * @param {string} context.body.pass - Password
     * @returns {Promise<{status: string, error?: string}>} Test result with status and optional error
     */
    async testCredentials({homey, body}) {
        try {
            const result = await this._performCredentialTest(body);
            return { status: 'success' };
        } catch (error) {
            homey.log('testCredentials error', error);
            return {
                status: 'failure',
                error: error.message,
            };
        }
    },
    
    /**
     * Perform the actual credential test by making an HTTP request.
     * @private
     * @async
     * @param {Object} credentials - The credentials to test
     * @param {string} credentials.host - UniFi Protect host
     * @param {number} credentials.port - UniFi Protect port
     * @param {string} credentials.user - Username
     * @param {string} credentials.pass - Password
     * @returns {Promise<string>} Resolves with 'Valid credentials' on success
     * @throws {Error} Throws descriptive error for invalid credentials or connection issues
     */
    async _performCredentialTest(credentials) {
        return new Promise((resolve, reject) => {
            const webclient = new ProtectWebClient();
            webclient.setServerHost(credentials.host);
            webclient.setServerPort(credentials.port);

            const credentialsJson = JSON.stringify({
                username: credentials.user,
                password: credentials.pass,
            });

            const options = this._buildRequestOptions(credentials.host, credentials.port);
            const req = https.request(options, (res) => {
                this._handleCredentialTestResponse(res, resolve, reject);
            });

            req.on('error', (error) => {
                reject(new Error(`Invalid credentials (${error.message})`));
            });

            req.write(credentialsJson);
            req.end();
        });
    },
    
    /**
     * Build HTTPS request options for credential testing.
     * @private
     * @param {string} host - The host to connect to
     * @param {number} port - The port to connect to
     * @returns {Object} HTTPS request options
     */
    _buildRequestOptions(host, port) {
        return {
            method: 'POST',
            hostname: host,
            port: port,
            path: '/api/auth/login',
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Accept: 'application/json',
            },
            maxRedirects: 20,
            rejectUnauthorized: false,
            timeout: CREDENTIAL_TEST_TIMEOUT_MS,
            keepAlive: true,
        };
    },
    
    /**
     * Handle the HTTP response from credential testing.
     * @private
     * @param {Object} res - The HTTP response
     * @param {Function} resolve - Promise resolve function
     * @param {Function} reject - Promise reject function
     */
    _handleCredentialTestResponse(res, resolve, reject) {
        const statusCode = res.statusCode;
        
        // Check for specific error statuses
        if (statusCode === HTTP_STATUS_UNAUTHORIZED) {
            reject(new Error('Invalid credentials (401)'));
            return;
        }
        
        if (statusCode === HTTP_STATUS_FORBIDDEN) {
            reject(new Error('Invalid credentials (403)'));
            return;
        }
        
        if (statusCode === HTTP_STATUS_TOO_MANY_REQUESTS) {
            reject(new Error('Invalid credentials (429 - Too many attempts, please wait)'));
            return;
        }
        
        if (statusCode !== HTTP_STATUS_OK) {
            reject(new Error(`Invalid credentials (${statusCode})`));
            return;
        }
        
        // Collect response body (not currently used but included for compatibility)
        const body = [];
        res.on('data', (chunk) => body.push(chunk));
        
        // Success
        resolve('Valid credentials');
    },
};
