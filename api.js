'use strict';

const https = require('https');
const ProtectWebClient = require('./library/webclient');

module.exports = {
    async getStatus({homey, query}) {
        return homey.app.api.loggedInStatus;
    },
    async getWebsocketStatus({homey, query}) {
        return homey.app.api.ws.isWebsocketConnected() ? 'Connected' : 'Unknown';
    },
    async getLastWebsocketMessageTime({homey, query}) {
        return homey.app.api.ws.getLastWebsocketMessageTime();
    },
    async getAccessWebsocketStatus({homey, query}) {
        return homey.app.accessApi.websocket.isWebsocketConnected() ? 'Connected' : 'Unknown';
    },
    async getLastAccessWebsocketMessageTime({homey, query}) {
        return homey.app.accessApi.websocket.getLastWebsocketMessageTime();
    },
    async getProtectV2WebsocketStatus({homey, query}) {
        return homey.app.apiV2.websocket.isWebsocketConnected() ? 'Connected' : 'Unknown';
    },
    async getLastProtectV2WebsocketMessageTime({homey, query}) {
        return homey.app.apiV2.websocket.getLastWebsocketMessageTime();
    },
    async testCredentials({homey, body}) {
        try {
            return new Promise((resolve, reject) => {
                this.webclient = new ProtectWebClient();
                this.webclient.setServerHost(body.host);
                this.webclient.setServerPort(body.port);

                // homey.app.api.getCSRFToken(body.host, body.port).then(response => {
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
                    // 429
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
                // });
            }).then((result) => {
                return {
                    status: 'success',
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
    },
};
