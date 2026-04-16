'use strict';

const https = require('https');
const ProtectWebClient = require('./library/webclient');

module.exports = {
    async getStatus({homey, query}) {
        // Return status based on which API is available
        if (homey.app.isV1Available()) {
            return homey.app.api.loggedInStatus;
        }
        if (homey.app.isV2Available()) {
            return homey.app.apiV2.loggedInStatus || 'Connected (V2)';
        }
        return homey.app.api.loggedInStatus || 'Not configured';
    },
    async getWebsocketStatus({homey, query}) {
        return homey.app.api.ws.isWebsocketConnected() ? 'Connected' : 'Unknown';
    },
    async getLastWebsocketMessageTime({homey, query}) {
        return homey.app.api.ws.getLastWebsocketMessageTime();
    },
    async getAccessWebsocketStatus({homey, query}) {
        const tokens = homey.settings.get('ufp:tokens');
        if (tokens && typeof tokens.accessApiKey !== 'undefined' && tokens.accessApiKey !== '') {
            return homey.app.accessApi.websocket.isWebsocketConnected() ? 'Connected' : 'Unknown';
        } else {
            return 'No API Key found';
        }
    },
    async getLastAccessWebsocketMessageTime({homey, query}) {
        return homey.app.accessApi.websocket.getLastWebsocketMessageTime();
    },
    async getProtectV2WebsocketStatus({homey, query}) {
        const tokens = homey.settings.get('ufp:tokens');
        if (tokens && typeof tokens.protectV2ApiKey !== 'undefined' && tokens.protectV2ApiKey !== '') {
            return homey.app.apiV2.websocket.isWebsocketConnected() ? 'Connected' : 'Unknown';
        } else {
            return 'No API Key found';
        }
    },
    async getLastProtectV2WebsocketMessageTime({homey, query}) {
        return homey.app.apiV2.websocket.getLastWebsocketMessageTime();
    },
    async testCredentials({homey, body}) {
        // Test V1 (username/password) credentials
        if (body.user && body.pass) {
            try {
                return new Promise((resolve, reject) => {
                    const credentials = JSON.stringify({
                        username: body.user,
                        password: body.pass,
                    });

                    const options = {
                        method: 'POST',
                        hostname: body.host,
                        port: body.port,
                        path: '/api/auth/login',
                        headers: {
                            'Content-Type': 'application/json; charset=utf-8',
                            Accept: 'application/json',
                        },
                        maxRedirects: 20,
                        rejectUnauthorized: false,
                        timeout: 2000,
                        keepAlive: true,
                    };

                    const req = https.request(options, (res) => {
                        if (res.statusCode === 401) {
                            reject(new Error('Invalid credentials (401)'));
                            return;
                        }
                        if (res.statusCode === 403) {
                            reject(new Error('Invalid credentials (403)'));
                            return;
                        }
                        if (res.statusCode === 429) {
                            reject(new Error('Invalid credentials (429 - Too many attempts, please wait)'));
                            return;
                        }
                        if (res.statusCode !== 200) {
                            reject(new Error(`Invalid credentials (${res.statusCode})`));
                            return;
                        }
                        const body = [];

                        res.on('data', (chunk) => body.push(chunk));
                        resolve('Valid credentials');
                    });

                    req.on('error', (error) => {
                        reject(new Error(`Invalid credentials (${error.message})`));
                    });

                    req.write(credentials);
                    req.end();
                }).then((result) => {
                    return {
                        status: 'success',
                        message: 'V1 credentials valid',
                    };
                }).catch((error) => {
                    return {
                        status: 'failure',
                        error,
                    };
                });
            } catch (error) {
                homey.log('testCredentials error', error);
                return {
                    status: 'failure',
                    error: error.message,
                };
            }
        }

        // If no V1 credentials, test V2 API key
        if (body.protectV2ApiKey) {
            return this.testV2ApiKey({homey, body});
        }

        return {
            status: 'failure',
            error: 'No credentials or API key provided',
        };
    },
    async testV2ApiKey({homey, body}) {
        try {
            return new Promise((resolve, reject) => {
                const options = {
                    method: 'GET',
                    hostname: body.host,
                    port: body.port || 443,
                    path: '/proxy/protect/integration/v1/cameras',
                    headers: {
                        'Content-Type': 'application/json; charset=utf-8',
                        Accept: '*/*',
                        'X-API-KEY': body.protectV2ApiKey,
                    },
                    maxRedirects: 20,
                    rejectUnauthorized: false,
                    timeout: 5000,
                    keepAlive: true,
                };

                const req = https.request(options, (res) => {
                    const data = [];
                    res.on('data', (chunk) => data.push(chunk));
                    res.on('end', () => {
                        if (res.statusCode === 401) {
                            reject(new Error('Invalid API key (401)'));
                            return;
                        }
                        if (res.statusCode === 403) {
                            reject(new Error('Invalid API key (403)'));
                            return;
                        }
                        if (res.statusCode !== 200) {
                            reject(new Error(`API key test failed (${res.statusCode})`));
                            return;
                        }
                        resolve('Valid V2 API key');
                    });
                });

                req.on('error', (error) => {
                    reject(new Error(`V2 API key test failed (${error.message})`));
                });

                req.end();
            }).then((result) => {
                return {
                    status: 'success',
                    message: 'V2 API key valid',
                };
            }).catch((error) => {
                return {
                    status: 'failure',
                    error,
                };
            });
        } catch (error) {
            homey.log('testV2ApiKey error', error);
            return {
                status: 'failure',
                error: error.message,
            };
        }
    },
};
