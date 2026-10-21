'use strict';

const CameraDevice = require('../../drivers/protectcamera/device');
const DoorbellDevice = require('../../drivers/protectdoorbell/device');

function createDevice(DeviceClass) {
  const device = Object.create(DeviceClass.prototype);
  let streamFn = null;
  const image = {
    setStream: (fn) => {
      streamFn = fn;
    },
  };
  const getSnapshot = jest.fn(async () => Buffer.from([1]));
  device.settings = { useCameraSnapshot: false };
  device.homey = {
    app: {
      debug: () => {},
      isV1Available: () => false,
      isV2Available: () => true,
      apiV2: { getSnapshot },
    },
    images: { createImage: async () => image },
    __: (key) => key,
  };
  device.getName = () => 'Cam';
  device.getData = () => ({ id: 'c1' });
  device.getSetting = () => undefined;
  device.getCapabilityValue = () => null;
  device.setCameraImage = async () => {};
  device.error = (e) => {
    throw e;
  };
  const fetchImage = () => streamFn({ end: () => {} });
  return { device, getSnapshot, fetchImage };
}

describe('snapshot source', () => {
  test('camera requests the V2 snapshot without extra parameters', async () => {
    const { device, getSnapshot, fetchImage } = createDevice(CameraDevice);
    await device._createSnapshotImage();
    await fetchImage();
    expect(getSnapshot).toHaveBeenCalledWith('c1');
  });

  test('V2 is preferred over V1 when both are available', async () => {
    const { device, getSnapshot, fetchImage } = createDevice(CameraDevice);
    device.homey.app.isV1Available = () => true;
    device.homey.app.api = { snapshot: jest.fn(async () => Buffer.from([2])) };
    await device._createSnapshotImage();
    await fetchImage();
    expect(getSnapshot).toHaveBeenCalled();
    expect(device.homey.app.api.snapshot).not.toHaveBeenCalled();
  });

  test('falls back to V1 when the V2 snapshot fails', async () => {
    const { device, getSnapshot, fetchImage } = createDevice(DoorbellDevice);
    getSnapshot.mockRejectedValueOnce(new Error('503'));
    device.homey.app.isV1Available = () => true;
    device.homey.app.api = { snapshot: jest.fn(async () => Buffer.from([2])) };
    await device._createSnapshotImage();
    await fetchImage();
    expect(device.homey.app.api.snapshot).toHaveBeenCalledWith('c1');
  });

  test('rethrows the V2 error when V1 is not available', async () => {
    const { device, getSnapshot, fetchImage } = createDevice(CameraDevice);
    getSnapshot.mockRejectedValueOnce(new Error('offline'));
    await device._createSnapshotImage();
    await expect(fetchImage()).rejects.toThrow('offline');
  });

  // Regression: the V2 package snapshot used to fetch the main camera image.
  test('doorbell package snapshot requests the package channel', async () => {
    const { device, getSnapshot, fetchImage } = createDevice(DoorbellDevice);
    await device._createSnapshotPackageImage();
    await fetchImage();
    expect(getSnapshot).toHaveBeenCalledWith('c1', { channel: 'package' });
  });

  test('doorbell package snapshot falls back to the V1 package endpoint', async () => {
    const { device, getSnapshot, fetchImage } = createDevice(DoorbellDevice);
    getSnapshot.mockRejectedValueOnce(new Error('503'));
    device.homey.app.isV1Available = () => true;
    device.homey.app.api = { packageSnapshot: jest.fn(async () => Buffer.from([2])) };
    await device._createSnapshotPackageImage();
    await fetchImage();
    expect(device.homey.app.api.packageSnapshot).toHaveBeenCalledWith('c1');
  });
});
