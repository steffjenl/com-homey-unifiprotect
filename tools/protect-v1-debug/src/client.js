'use strict';

const https = require('https');

function requestJson(options, body) {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const cookieHeader = Array.isArray(res.headers['set-cookie']) && res.headers['set-cookie'].length > 0
          ? res.headers['set-cookie'][0]
          : null;

        if (res.statusCode === 401 || res.statusCode === 403) {
          return reject(new Error('Authentication/authorization failed (' + res.statusCode + ').'));
        }

        if (res.statusCode === 429) {
          return reject(new Error('Rate limited (429).'));
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error('Request failed: ' + options.method + ' ' + options.path + ' (' + res.statusCode + ') ' + text));
        }

        let parsed = null;
        if (text && text.trim() !== '') {
          try {
            parsed = JSON.parse(text);
          } catch (error) {
            return reject(new Error('Invalid JSON response for ' + options.path + ': ' + error.message));
          }
        }

        return resolve({
          data: parsed,
          cookie: cookieHeader,
        });
      });
    });

    req.on('error', (error) => reject(error));

    if (body) {
      req.write(body);
    }

    req.end();
  });
}

async function login(config) {
  const payload = JSON.stringify({
    username: config.username,
    password: config.password,
  });

  const options = {
    method: 'POST',
    hostname: config.host,
    port: config.port,
    path: '/api/auth/login',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Accept: 'application/json',
      'Content-Length': Buffer.byteLength(payload),
    },
    rejectUnauthorized: false, // rejectUnauthorized: false is intentional — NVR often uses self-signed TLS
    timeout: 5000,
    keepAlive: true,
  };

  const response = await requestJson(options, payload);
  if (!response.cookie) {
    throw new Error('Login succeeded but no set-cookie header was returned.');
  }

  return response.cookie;
}

async function getBootstrap(config, cookie) {
  const options = {
    method: 'GET',
    hostname: config.host,
    port: config.port,
    path: '/proxy/protect/api/bootstrap',
    headers: {
      Accept: 'application/json',
      Cookie: cookie,
    },
    rejectUnauthorized: false, // rejectUnauthorized: false is intentional — NVR often uses self-signed TLS
    timeout: 5000,
    keepAlive: true,
  };

  const response = await requestJson(options);
  if (!response.data || typeof response.data !== 'object') {
    throw new Error('Bootstrap response is empty or invalid.');
  }

  return {
    bootstrap: response.data,
    cookie: response.cookie || cookie,
  };
}

module.exports = {
  login,
  getBootstrap,
};
