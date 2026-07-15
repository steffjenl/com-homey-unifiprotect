'use strict';

// Smoke test for the UP-AirQuality event wiring added in drivers/protectsensor/device.js:
// onVapeDetected / onExtremeValue / onSensorAlarm. Exercises the handlers directly against a
// fake device harness (dynamic capability add + value tracking) using payload shapes taken
// straight from the sensorVapeEvent / sensorExtremeValueEvent / sensorAlarmEvent schemas in
// specs/protect-integration-v2-openapi.json (API v7.1.87). No real console/hardware needed.

const Module = require('module');
const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'homey') {
    return {
      SimpleClass: class SimpleClass {},
      App: class App {},
      Device: class Device {},
      Driver: class Driver {},
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const Sensor = require('../drivers/protectsensor/device');

// Built on Sensor.prototype (via Object.create) so the private helpers the handlers rely on
// (e.g. _ensureCapability) resolve through the prototype chain, while the Homey.Device
// primitives they call (hasCapability/addCapability/setCapabilityValue/...) are faked here.
function createFakeSensorDevice() {
  const device = Object.create(Sensor.prototype);
  device.capabilities = new Set(['alarm_contact']);
  device.capabilityValues = {};
  device.homey = {
    app: { debug: () => {} },
    setTimeout: () => -1,
    clearTimeout: () => {},
  };

  device.hasCapability = (name) => device.capabilities.has(name);
  device.addCapability = async (name) => { device.capabilities.add(name); };
  device.removeCapability = async (name) => { device.capabilities.delete(name); };
  device.setCapabilityValue = (name, value) => {
    device.capabilityValues[name] = value;
    return Promise.resolve();
  };
  device.getName = () => 'Test AirQuality Sensor';
  device.getData = () => ({ id: 'sensor-1' });
  device.error = (err) => { throw err; };

  return device;
}

// Structurally identical to a real UP-AirQuality bootstrap capture (id/mac/host scrubbed),
// used to verify _createMissingCapabilities/_initSensorData against real field shapes rather
// than hand-guessed ones.
const AIRQUALITY_BOOTSTRAP_SENSOR = {
  id: 'airquality-1',
  type: 'UP-AirQuality',
  name: 'UP Air Living',
  modelKey: 'sensor',
  isOpened: null,
  motionSettings: { isEnabled: false, sensitivity: 100, sensitivityWhenArmed: 50 },
  alarmSettings: { isEnabled: false },
  glassBreakSettings: { isEnabled: false, sensitivity: 25, sensitivityWhenArmed: 50 },
  stats: {
    light: { value: null, status: 'unknown' },
    humidity: { value: null, status: 'unknown' },
    temperature: { value: null, status: 'unknown' },
  },
  airQuality: {
    aqi: { value: 0, status: 'neutral' },
    vape: { value: 0, status: 'neutral' },
    tvoc: { value: 11.6, status: 'neutral' },
    pm1p0: { value: 0, status: 'neutral' },
    pm2p5: { value: 0, status: 'neutral' },
    pm4p0: { value: 0, status: 'neutral' },
    pm10p0: { value: 0, status: 'neutral' },
    humidity: { value: 40.2, status: 'neutral' },
    temperature: { value: 28.07, status: 'neutral' },
    voc: { value: 74, status: 'neutral' },
    co2: { value: 494, status: 'neutral' },
  },
  smokeStatus: {
    enabled: false, smokeAlarm: false, coAlarm: false, batteryLow: false,
  },
  batteryStatus: { percentage: null, isLow: false, modelKey: 'sensorBatteryStatus' },
};

function createFakeBootstrapDevice(sensor) {
  const device = createFakeSensorDevice();
  device.getData = () => ({ id: sensor.id });
  device.getClass = () => 'sensor';
  device.setClass = async () => {};
  device.homey.app.api = { getBootstrap: () => ({ sensors: [sensor] }) };
  return device;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runBootstrapFixtureTest() {
  const sensor = JSON.parse(JSON.stringify(AIRQUALITY_BOOTSTRAP_SENSOR));
  const device = createFakeBootstrapDevice(sensor);

  await device._createMissingCapabilities();

  // sensor.stats.{humidity,temperature} are null on UP-AirQuality - must fall back to
  // sensor.airQuality.{humidity,temperature} instead of staying absent.
  assert(device.hasCapability('measure_humidity'), 'expected measure_humidity via airQuality fallback');
  assert(device.hasCapability('measure_temperature'), 'expected measure_temperature via airQuality fallback');
  assert(!device.hasCapability('measure_luminance'), 'stats.light is null - measure_luminance must not be added');

  for (const capability of ['measure_aqi', 'measure_co2', 'measure_tvoc_index', 'measure_tvoc', 'measure_pm1', 'measure_pm25', 'measure_pm4', 'measure_pm10', 'alarm_vape']) {
    assert(device.hasCapability(capability), `expected ${capability} to be created from sensor.airQuality`);
  }

  // alarmSettings.isEnabled=false in this capture -> smoke/CO alarm not applicable yet
  assert(!device.hasCapability('alarm_smoke'), 'alarmSettings.isEnabled=false - alarm_smoke must not be added');
  assert(!device.hasCapability('alarm_co'), 'alarmSettings.isEnabled=false - alarm_co must not be added');

  // UP-AirQuality has no contact switch or tamper switch hardware - never offer these
  assert(!device.hasCapability('alarm_contact'), 'UP-AirQuality has no contact switch - alarm_contact must not be added');
  assert(!device.hasCapability('alarm_tamper'), 'UP-AirQuality has no tamper switch - alarm_tamper must not be added');

  // batteryStatus is present (wired/PoE, percentage null) -> alarm_battery yes, measure_battery no
  assert(device.hasCapability('alarm_battery'), 'expected alarm_battery from sensor.batteryStatus');
  assert(!device.hasCapability('measure_battery'), 'batteryStatus.percentage=null - measure_battery must not be added');

  await device._initSensorData();
  assert(device.capabilityValues.measure_humidity === 40.2, 'expected measure_humidity=40.2 from airQuality fallback');
  assert(device.capabilityValues.measure_temperature === 28.07, 'expected measure_temperature=28.07 from airQuality fallback');
  assert(device.capabilityValues.measure_co2 === 494, 'expected measure_co2=494');
  assert(device.capabilityValues.measure_tvoc_index === 74, 'expected measure_tvoc_index=74 (voc metric)');
  assert(device.capabilityValues.measure_tvoc === 11.6, 'expected measure_tvoc=11.6 (tvoc metric)');
  assert(device.capabilityValues.alarm_battery === false, 'expected alarm_battery=false from batteryStatus.isLow');

  // Live update: a later websocket payload bumps CO2 and reports battery/smoke state
  device.onAirQualityChange({ co2: { value: 550, status: 'neutral' } });
  assert(device.capabilityValues.measure_co2 === 550, 'expected measure_co2=550 after live update');

  device.onBatteryStatusChange({ isLow: true, percentage: null });
  assert(device.capabilityValues.alarm_battery === true, 'expected alarm_battery=true after live update');

  // alarm_smoke/alarm_co were never created (feature disabled) - a smokeStatus update must be a no-op
  device.onSmokeStatusChange({ smokeAlarm: true, coAlarm: false });
  assert(!device.hasCapability('alarm_smoke'), 'onSmokeStatusChange must not create a capability that bootstrap gating disabled');

  // eslint-disable-next-line no-console
  console.log('Bootstrap fixture smoke test passed', JSON.stringify(device.capabilityValues));
}

// Regression guard: a plain contact/motion Sensor (not UP-AirQuality) must keep getting
// alarm_contact/alarm_tamper - the type-based gating above must not affect other sensors.
async function runPlainSensorFixtureTest() {
  const sensor = {
    id: 'plain-sensor-1',
    type: 'UP Sensor',
    isOpened: false,
    stats: {
      light: { value: null, status: 'unknown' },
      humidity: { value: null, status: 'unknown' },
      temperature: { value: null, status: 'unknown' },
    },
    motionSettings: { isEnabled: false },
    alarmSettings: { isEnabled: false },
    glassBreakSettings: { isEnabled: false },
  };
  const device = createFakeBootstrapDevice(sensor);

  await device._createMissingCapabilities();
  assert(device.hasCapability('alarm_contact'), 'plain Sensor must still get alarm_contact');
  assert(device.hasCapability('alarm_tamper'), 'plain Sensor must still get alarm_tamper');
  for (const capability of ['measure_aqi', 'measure_co2', 'measure_tvoc', 'alarm_vape']) {
    assert(!device.hasCapability(capability), `plain Sensor without sensor.airQuality must not get ${capability}`);
  }

  // eslint-disable-next-line no-console
  console.log('Plain sensor fixture smoke test passed', JSON.stringify([...device.capabilities]));
}

async function run() {
  const device = createFakeSensorDevice();

  // sensorVapeEvent: {type:"add"} -> alarm_vape true, lazily creates the capability
  await device.onVapeDetected('add', 1779653018028, null);
  assert(device.hasCapability('alarm_vape'), 'expected alarm_vape to be created');
  assert(device.capabilityValues.alarm_vape === true, 'expected alarm_vape=true on add');

  // sensorVapeEvent: {type:"update", end:<ts>} -> alarm_vape false
  await device.onVapeDetected('update', 1779653018028, 1779653020000);
  assert(device.capabilityValues.alarm_vape === false, 'expected alarm_vape=false on update+end');

  // sensorExtremeValueEvent metadata.sensorType.text="co2" -> measure_co2 (Homey system capability)
  await device.onExtremeValue('co2', '1200', 'high');
  assert(device.hasCapability('measure_co2'), 'expected measure_co2 to be created');
  assert(device.capabilityValues.measure_co2 === 1200, 'expected measure_co2=1200');

  // sensorExtremeValueEvent metadata.sensorType.text="pm2p5" -> measure_pm25 (Homey system capability)
  await device.onExtremeValue('pm2p5', '35.5', 'high');
  assert(device.hasCapability('measure_pm25'), 'expected measure_pm25 to be created');
  assert(device.capabilityValues.measure_pm25 === 35.5, 'expected measure_pm25=35.5');

  // sensorExtremeValueEvent metadata.sensorType.text="aqi" -> measure_aqi (Homey system capability)
  await device.onExtremeValue('aqi', '180', 'high');
  assert(device.hasCapability('measure_aqi'), 'expected measure_aqi to be created');
  assert(device.capabilityValues.measure_aqi === 180, 'expected measure_aqi=180');

  // sensorExtremeValueEvent metadata.sensorType.text="pm4p0" -> custom measure_pm4 (no
  // system "PM4.0" tier exists in Homey's capability set)
  await device.onExtremeValue('pm4p0', '12', 'normal');
  assert(device.hasCapability('measure_pm4'), 'expected measure_pm4 to be created');
  assert(device.capabilityValues.measure_pm4 === 12, 'expected measure_pm4=12');

  // unmapped metric (e.g. 'vape' or 'temperature') must not throw and must not add a capability
  const capabilityCountBefore = device.capabilities.size;
  await device.onExtremeValue('temperature', '21.5', 'normal');
  assert(device.capabilities.size === capabilityCountBefore, 'unmapped metric must not add a capability');

  // sensorAlarmEvent metadata.alarmType.text="glassBreak" -> custom alarm_glassbreak, active
  await device.onSensorAlarm('glassBreak', 'add', null);
  assert(device.hasCapability('alarm_glassbreak'), 'expected alarm_glassbreak to be created');
  assert(device.capabilityValues.alarm_glassbreak === true, 'expected alarm_glassbreak=true');

  // sensorAlarmEvent metadata.alarmType.text="smoke" -> alarm_smoke (Homey system capability), cleared
  await device.onSensorAlarm('smoke', 'update', 1779653020000);
  assert(device.hasCapability('alarm_smoke'), 'expected alarm_smoke to be created');
  assert(device.capabilityValues.alarm_smoke === false, 'expected alarm_smoke=false once ended');

  // sensorAlarmEvent metadata.alarmType.text="sensorButtonPress" has no capability mapping (yet)
  const capabilityCountBeforeUnmapped = device.capabilities.size;
  await device.onSensorAlarm('sensorButtonPress', 'add', null);
  assert(device.capabilities.size === capabilityCountBeforeUnmapped, 'unmapped alarmType must not add a capability');

  // eslint-disable-next-line no-console
  console.log('Sensor event smoke test passed', JSON.stringify(device.capabilityValues));

  await runBootstrapFixtureTest();
  await runPlainSensorFixtureTest();
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
