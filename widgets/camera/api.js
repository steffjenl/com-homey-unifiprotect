'use strict';

const https = require('https');

module.exports = {
  async getSnapshotUrl({ homey, query }) {
    const { deviceId } = query;

    const driver = homey.drivers.getDriver('protectcamera');
    if (!driver) {
      throw new Error('Camera driver not found');
    }

    const device = driver.getUnifiDeviceById(deviceId);
    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }

    return device.cloudUrl ?? 'loading.png';
  },

  async getSnapshot({ homey, query }) {
    const { deviceId, live } = query;

    const webclient = homey.app.apiV2?.webclient;
    if (live !== 'true' || !webclient?._serverHost) {
      const driver = homey.drivers.getDriver('protectcamera');
      const device = driver?.getUnifiDeviceById(deviceId);
      return device?.cloudUrl ?? 'loading.png';
    }

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: webclient._serverHost,
          port: webclient._serverPort,
          path: webclient.buildApiPath(`cameras/${deviceId}/snapshot`),
          method: 'GET',
          headers: { 'X-API-KEY': webclient._apiToken },
          rejectUnauthorized: false,
        },
        (res) => {
          if (res.statusCode !== 200) {
            res.resume();
            return reject(new Error(`Snapshot fetch failed with status ${res.statusCode}`));
          }
          const chunks = [];
          res.on('data', (chunk) => chunks.push(chunk));
          res.on('end', () => resolve(`data:image/jpeg;base64,${Buffer.concat(chunks).toString('base64')}`));
        },
      );
      req.setTimeout(5000, () => req.destroy(new Error('snapshot request timed out')));
      req.on('error', reject);
      req.end();
    });
  },
};
