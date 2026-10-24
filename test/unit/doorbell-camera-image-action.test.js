'use strict';

// "Get the current camera image" action card (drivers/protectdoorbell/device.js): the live snapshot
// is read once per run, every pipe of the returned tag gives those same bytes, a later run does not
// change an earlier run's picture, the tag lives for the card's minutes field (30 when empty, at most 999),
// and a failed fetch fails the card instead of returning a broken tag.

const { PassThrough, Readable } = require('stream');
const Doorbell = require('../../drivers/protectdoorbell/device');
const DoorbellDriver = require('../../drivers/protectdoorbell/driver');
const { ACTION_GET_DEVICE_DOORBELL_CAMERA_IMAGE } = require('../../library/constants');

class FakeImage {

  constructor() {
    this.unregister = jest.fn(() => Promise.resolve());
  }

  setStream(source) {
    this.source = source;
  }

  // Mirrors Homey: the source runs again for every consumer that pipes the image
  async read() {
    const stream = new PassThrough();
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    const ended = new Promise((resolve) => stream.on('end', resolve));
    await this.source(stream);
    await ended;
    return Buffer.concat(chunks).toString();
  }

}

function createDoorbell({ createImage } = {}) {
  let frame = 0;
  const timers = [];
  const device = Object.create(Doorbell.prototype);
  device.getName = () => 'Front door';
  device.error = jest.fn();
  device._snapshotImage = {
    getStream: jest.fn(async () => {
      frame += 1;
      return Readable.from([Buffer.from(`frame-${frame}`)]);
    }),
  };
  device.homey = {
    app: { debug: () => {} },
    images: { createImage: jest.fn(createImage || (async () => new FakeImage())) },
    setTimeout: (fn, ms) => timers.push({ fn, ms }),
  };
  return { device, timers };
}

describe('doorbell "Get the current camera image" action', () => {
  test('every pipe of one run returns the same frame from a single fetch', async () => {
    const { device } = createDoorbell();
    const image = await device.createFrozenSnapshotImage();

    const [first, second] = await Promise.all([image.read(), image.read()]);
    const third = await image.read();

    expect(first).toBe('frame-1');
    expect(second).toBe('frame-1');
    expect(third).toBe('frame-1');
    expect(device._snapshotImage.getStream).toHaveBeenCalledTimes(1);
  });

  test('a second run does not change the first run picture', async () => {
    const { device } = createDoorbell();
    const first = await device.createFrozenSnapshotImage();
    const second = await device.createFrozenSnapshotImage();

    expect(await second.read()).toBe('frame-2');
    expect(await first.read()).toBe('frame-1');
  });

  test('the image is unregistered after the chosen number of minutes', async () => {
    const { device, timers } = createDoorbell();
    const image = await device.createFrozenSnapshotImage(5);

    expect(timers).toHaveLength(1);
    expect(timers[0].ms).toBe(5 * 60 * 1000);
    timers[0].fn();
    expect(image.unregister).toHaveBeenCalledTimes(1);
  });

  test.each([
    ['left empty', undefined, 30],
    ['zero', 0, 30],
    ['negative', -5, 30],
    ['not a number', NaN, 30],
    ['above the maximum', 5000, 999],
  ])('minutes %s falls back to a valid lifetime', async (label, minutes, expected) => {
    const { device, timers } = createDoorbell();
    await device.createFrozenSnapshotImage(minutes);

    expect(timers[0].ms).toBe(expected * 60 * 1000);
  });

  test('a failed fetch rejects the card and creates no image', async () => {
    const { device } = createDoorbell();
    device._snapshotImage = null;

    await expect(device.createFrozenSnapshotImage()).rejects.toThrow('Snapshot image is not ready yet.');
    expect(device.homey.images.createImage).not.toHaveBeenCalled();
  });

  test('an empty snapshot rejects the card', async () => {
    const { device } = createDoorbell();
    device._snapshotImage.getStream = async () => Readable.from([]);

    await expect(device.createFrozenSnapshotImage()).rejects.toThrow('Snapshot is empty.');
  });

  test('the driver returns the image as the card tag', async () => {
    const cards = {};
    const fakeCard = () => ({ registerRunListener: jest.fn(), registerArgumentAutocompleteListener: jest.fn() });
    const driver = Object.create(DoorbellDriver.prototype);
    driver.homey = {
      app: { debug: () => {} },
      flow: {
        getDeviceTriggerCard: () => fakeCard(),
        getActionCard: (id) => {
          cards[id] = fakeCard();
          return cards[id];
        },
      },
    };
    await driver.onInit();

    const { device, timers } = createDoorbell();
    const [listener] = cards[ACTION_GET_DEVICE_DOORBELL_CAMERA_IMAGE].registerRunListener.mock.calls[0];
    const tokens = await listener({ device, minutes: 10 });

    expect(Object.keys(tokens)).toEqual(['ufp_camera_image']);
    expect(await tokens.ufp_camera_image.read()).toBe('frame-1');
    expect(timers[0].ms).toBe(10 * 60 * 1000);
  });
});
