'use strict';

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
};
