'use strict';

const BaseClass = require('../baseclass');
const UfvConstants = require('../constants');
const https = require('node:https');

class WebClient extends BaseClass {
    constructor(...props) {
        super(...props);

        this._serverHost = null;
        this._serverPort = 443;
        this._apiToken = null;
        this._cloudEnabled = false;
        this._consoleId = '';
    }

    setSettings(host, port, apiToken, options = {}) {
        this._serverHost = host;
        this._serverPort = port;
        this._apiToken = apiToken;
        this._cloudEnabled = !!options.cloudEnabled;
        this._consoleId = options.consoleId || '';
    }

    isCloudEnabled() {
        return this._cloudEnabled === true;
    }

    getRequestHost() {
        return this.isCloudEnabled() ? 'api.ui.com' : this._serverHost;
    }

    getRequestPort() {
        return this.isCloudEnabled() ? 443 : this._serverPort;
    }

    getIntegrationPrefix() {
        if (this.isCloudEnabled()) {
            return `/v1/connector/consoles/${encodeURIComponent(this._consoleId)}`
                + `${UfvConstants.PROTECT_V2_API_BASE_PATH}/${UfvConstants.PROTECT_V2_API_VERSION}`;
        }

        return `${UfvConstants.PROTECT_V2_API_BASE_PATH}/${UfvConstants.PROTECT_V2_API_VERSION}`;
    }

    buildApiPath(resource = '', params = null) {
        const normalizedResource = String(resource || '').replace(/^\/+/, '');
        const path = normalizedResource
            ? `${this.getIntegrationPrefix()}/${normalizedResource}`
            : this.getIntegrationPrefix();
        return `${path}${this.toQueryString(params)}`;
    }

    async get(resource, params = {}, isBinary = false) {
        return new Promise((resolve, reject) => {
            const options = {
                method: 'GET',
                hostname: this.getRequestHost(),
                port: this.getRequestPort(),
                path: this.buildApiPath(resource, params),
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    Accept: isBinary ? '*/*' : 'application/json',
                    'X-API-KEY': `${this._apiToken}`,
                },
                maxRedirects: 20,
                rejectUnauthorized: false,
                keepAlive: true,
            };

            const req = https.request(options, res => {
                const data = [];

                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    if (res.statusCode === 403) {
                        return reject(new Error(`Homey user has no permission to perform this action. Please check the user's role.`));
                    }

                    if (res.statusCode !== 200) {
                        return reject(new Error(`Failed to GET url: ${options.path} (status code: ${res.statusCode}, response: ${data.join('')})`));
                    }

                    if (isBinary) {
                        return resolve(Buffer.concat(data));
                    }

                    return resolve(data.join(''));
                });
            });

            req.on('error', error => reject(error));
            req.end();
        });
    }
    async post(resource, payload = {}) {
        return new Promise((resolve, reject) => {
            const body = JSON.stringify(payload);

            const options = {
                method: 'POST',
                hostname: this.getRequestHost(),
                port: this.getRequestPort(),
                path: this.buildApiPath(resource),
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body),
                    Accept: '*/*',
                    'X-API-KEY': `${this._apiToken}`,
                },
                maxRedirects: 20,
                rejectUnauthorized: false,
                keepAlive: true,
            };

            const req = https.request(options, res => {
                res.setEncoding('utf8');
                const data = [];

                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    if (res.statusCode === 403) {
                        return reject(new Error(`Homey user has no permission to perform this action. Please check the user's role.`));
                    }

                    if (res.statusCode !== 200 && res.statusCode !== 201 && res.statusCode !== 204) {
                        return reject(new Error(`Failed to POST to url: ${options.path} (status code: ${res.statusCode}, response: ${data.join('')})`));
                    }

                    return resolve(data.join(''));
                });
            });

            req.on('error', error => reject(error));
            req.write(body);
            req.end();
        });
    }
    async put(resource, payload = {}) {
        return new Promise((resolve, reject) => {
            const body = JSON.stringify(payload);

            const params = {};

            const options = {
                method: 'PUT',
                hostname: this.getRequestHost(),
                port: this.getRequestPort(),
                path: this.buildApiPath(resource, params),
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body),
                    Accept: '*/*',
                    'X-API-KEY': `${this._apiToken}`,
                },
                maxRedirects: 20,
                rejectUnauthorized: false,
                keepAlive: true,
            };

            const req = https.request(options, res => {
                res.setEncoding('utf8');
                const data = [];

                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    if (res.statusCode === 403) {
                        return reject(new Error(`Homey user has no permission to perform this action. Please check the user's role.`));
                    }

                    if (res.statusCode !== 200) {
                        return reject(new Error(`Failed to PUT to url: ${options.host}${options.path} (status code: ${res.statusCode}, response: ${data.join('')})`));
                    }

                    return resolve(data.join(''));
                });
            });

            req.on('error', error => reject(error));
            req.write(body);
            req.end();
        });
    }
    async patch(resource, payload = {}) {
        return new Promise((resolve, reject) => {
            const body = JSON.stringify(payload);

            const params = {};

            const options = {
                method: 'PATCH',
                hostname: this.getRequestHost(),
                port: this.getRequestPort(),
                path: this.buildApiPath(resource, params),
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Content-Length': Buffer.byteLength(body),
                    Accept: '*/*',
                    'X-API-KEY': `${this._apiToken}`,
                },
                maxRedirects: 20,
                rejectUnauthorized: false,
                keepAlive: true,
            };

            const req = https.request(options, res => {
                res.setEncoding('utf8');
                const data = [];

                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    if (res.statusCode === 403) {
                        return reject(new Error(`Homey user has no permission to perform this action. Please check the user's role.`));
                    }

                    // 204 No Content is a valid success response (e.g. arm/disarm endpoints)
                    if (res.statusCode !== 200 && res.statusCode !== 204) {
                        return reject(new Error(`Failed to PATCH to url: ${options.host}${options.path} (status code: ${res.statusCode}, response: ${data.join('')})`));
                    }

                    return resolve(data.join(''));
                });
            });

            req.on('error', error => reject(error));
            req.write(body);
            req.end();
        });
    }

    async delete(resource) {
        return new Promise((resolve, reject) => {
            const options = {
                method: 'DELETE',
                hostname: this.getRequestHost(),
                port: this.getRequestPort(),
                path: this.buildApiPath(resource),
                headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    Accept: '*/*',
                    'X-API-KEY': `${this._apiToken}`,
                },
                maxRedirects: 20,
                rejectUnauthorized: false,
                keepAlive: true,
            };

            const req = https.request(options, res => {
                res.setEncoding('utf8');
                const data = [];

                res.on('data', chunk => data.push(chunk));
                res.on('end', () => {
                    if (res.statusCode === 403) {
                        return reject(new Error(`Homey user has no permission to perform this action. Please check the user's role.`));
                    }

                    // 204 No Content is the expected success response for DELETE arm
                    if (res.statusCode !== 200 && res.statusCode !== 204) {
                        return reject(new Error(`Failed to DELETE url: ${options.path} (status code: ${res.statusCode}, response: ${data.join('')})`));
                    }

                    return resolve(data.join(''));
                });
            });

            req.on('error', error => reject(error));
            req.end();
        });
    }

    toQueryString(obj) {
        if (obj === null || typeof obj === 'undefined' || Object.keys(obj).length === 0) {
            return '';
        }
        return `?${Object.keys(obj)
            .map(k => `${k}=${encodeURIComponent(obj[k])}`)
            .join('&')}`;
    }
}

module.exports = WebClient;
