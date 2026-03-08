'use strict';

module.exports = {
  async getSnapshotUrl({ homey, query }) {

    const { deviceId } = query;
    const { packageCamera } = query;

    const driver = homey.drivers.getDriver('protectdoorbell');
    if (!driver) {
      throw new Error('Doorbell driver not found');
    }

    const device = driver.getUnifiDeviceById(deviceId);
    if (!device) {
      throw new Error(`Device with ID ${deviceId} not found`);
    }

    if (packageCamera === 'true' && device.cloudUrlPackage) {
      return device.cloudUrlPackage;
    } if (device.cloudUrl) {
      return device.cloudUrl;
    }
    return 'loading.png';
  },
};
