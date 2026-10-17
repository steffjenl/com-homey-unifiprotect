'use strict';

const fs = require('fs');
const path = require('path');
const { createFakeBootstrapDevice } = require('../mocks/fake-sensor-device');
const airQualitySensor = require('../fixtures/bootstrap-sensor-airquality.json');

const ROOT = path.join(__dirname, '..', '..');
const CUSTOM_DIR = path.join(ROOT, '.homeycompose', 'capabilities');
const DRIVERS_DIR = path.join(ROOT, 'drivers');

const custom = new Set(fs.readdirSync(CUSTOM_DIR).filter((f) => f.endsWith('.json')).map((f) => f.replace(/\.json$/, '')));

// Homey system capabilities the app relies on (assumed from the Homey capability reference;
// extend when a driver legitimately starts using another one).
const SYSTEM = new Set([
  'onoff', 'dim', 'volume_set', 'homealarm_state', 'locked',
  'alarm_generic', 'alarm_motion', 'alarm_contact', 'alarm_tamper', 'alarm_battery',
  'alarm_smoke', 'alarm_co',
  'measure_battery', 'measure_signal_strength', 'measure_temperature', 'measure_humidity', 'measure_luminance',
  'measure_co2', 'measure_pm1', 'measure_pm25', 'measure_pm10', 'measure_aqi', 'measure_tvoc', 'measure_tvoc_index',
  'measure_data_size',
]);

const baseId = (id) => id.split('.')[0];
const isRegistered = (id) => custom.has(baseId(id)) || SYSTEM.has(baseId(id));

const drivers = fs.readdirSync(DRIVERS_DIR).filter((d) => fs.existsSync(path.join(DRIVERS_DIR, d, 'driver.compose.json')));

describe('custom capability definitions', () => {
  test.each([...custom])('%s.json is valid and has a title', (id) => {
    const def = JSON.parse(fs.readFileSync(path.join(CUSTOM_DIR, `${id}.json`), 'utf8'));
    expect(def.title).toBeTruthy();
    expect(def.type).toBeTruthy();
  });
});

describe('driver.compose.json capabilities', () => {
  test.each(drivers)('%s only declares registered capabilities', (driverId) => {
    const compose = JSON.parse(fs.readFileSync(path.join(DRIVERS_DIR, driverId, 'driver.compose.json'), 'utf8'));
    const unknown = (compose.capabilities || []).filter((id) => !isRegistered(id));
    expect(unknown).toEqual([]);
  });
});

// Run each device's _createMissingCapabilities on a blank fake device: it must only add
// registered capabilities and be idempotent (second run changes nothing).
function createGenericDevice(Device) {
  const dev = Object.create(Device.prototype);
  dev.caps = new Set();
  dev.added = [];
  dev.removed = [];
  dev.hasCapability = (id) => dev.caps.has(id);
  dev.addCapability = async (id) => {
    dev.caps.add(id);
    dev.added.push(id);
  };
  dev.removeCapability = async (id) => {
    dev.caps.delete(id);
    dev.removed.push(id);
  };
  dev.getClass = () => 'other';
  dev.setClass = async () => {};
  dev.getName = () => 'Test';
  dev.getData = () => ({ id: 'x' });
  dev.getStoreValue = () => null;
  dev.error = () => {};
  dev.log = () => {};
  dev.homey = { app: { debug: () => {}, api: { getBootstrap: () => ({}) } } };
  return dev;
}

const GENERIC = [
  'protect-fob', 'protect-horn-speaker', 'protect-nvr-alarm', 'protect-relay', 'protect-siren',
  'protect-weather', 'protect-zone-sensor', 'protectcamera', 'protectchime', 'protectdoorbell',
  'protectlight', 'unifi-os',
];

describe.each(GENERIC)('%s _createMissingCapabilities', (driverId) => {
  // eslint-disable-next-line global-require, import/no-dynamic-require
  const Device = require(`../../drivers/${driverId}/device`);

  test('adds only registered capabilities and is idempotent', async () => {
    const dev = createGenericDevice(Device);
    await dev._createMissingCapabilities();
    expect(dev.added.filter((id) => !isRegistered(id))).toEqual([]);

    const before = [...dev.caps].sort();
    dev.added.length = 0;
    dev.removed.length = 0;
    await dev._createMissingCapabilities();
    expect(dev.added).toEqual([]);
    expect(dev.removed).toEqual([]);
    expect([...dev.caps].sort()).toEqual(before);
  });
});

describe('protectsensor _createMissingCapabilities', () => {
  test.each([
    ['UP-AirQuality', airQualitySensor],
    ['plain sensor', {
      id: 'plain',
      type: 'UP Sensor',
      isOpened: false,
      stats: { light: { value: 1 }, humidity: { value: 2 }, temperature: { value: 3 } },
      motionSettings: { isEnabled: true },
      alarmSettings: { isEnabled: true },
      glassBreakSettings: { isEnabled: true },
    }],
  ])('%s: only registered capabilities, idempotent', async (_label, sensor) => {
    const device = createFakeBootstrapDevice(JSON.parse(JSON.stringify(sensor)));
    await device._createMissingCapabilities();
    const added = [...device.capabilities];
    expect(added.filter((id) => !isRegistered(id))).toEqual([]);

    await device._createMissingCapabilities();
    expect([...device.capabilities].sort()).toEqual(added.sort());
  });
});
