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

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
