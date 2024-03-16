const ProtectWebClient = require('./library/webclient');
const https = require("https");

module.exports = {
    async getStatus({ homey, query }) {
        const result = await homey.app.api.loggedInStatus;
        return result;
    },
    async getWebsocketStatus({ homey, query }) {
        return homey.app.api.ws.isWebsocketConnected() ? 'Connected' : 'Unknown';
    },
    async getLastWebsocketMessageTime({ homey, query }) {
        return homey.app.api.ws.getLastWebsocketMessageTime();
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

                    const req = https.request(options, res => {
                        if (res.statusCode !== 200) {
                            reject('Invalid credentials');
                            return;
                        }
                        const body = [];

                        res.on('data', chunk => body.push(chunk));
                        resolve('Valid credentials');
                    });

                    req.on('error', error => {
                        reject('Invalid credentials');
                    });

                    req.write(credentials);
                    req.end();
                //});
            }).then((result) => {
                return {
                    status: 'success',
                };
            }).catch((error) => {
                return {
                    status: 'failure',
                    error: error,
                };
            })
        } catch (error) {
            console.log('testCredentials error', error);
            return {
                status: 'failure',
                error: error.message,
            };
        }
    }
};
