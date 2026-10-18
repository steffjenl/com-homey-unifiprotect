'use strict';

const ProtectWebSocket = require('../../library/protect-api-v2/web-socket-events');
const { createWebSocketHarness } = require('../mocks/fake-v2-websocket');

function createSetup({ camera = true, doorbell = true, sensor = true } = {}) {
  const deviceCamera = camera ? { onMotionDetected: jest.fn(), onAudioDetection: jest.fn() } : null;
  const deviceDoorbell = doorbell ? { onMotionDetected: jest.fn(), onDoorbellRinging: jest.fn(), onAudioDetection: jest.fn() } : null;
  const deviceSensor = sensor ? {
    onVapeDetected: jest.fn(),
    onExtremeValue: jest.fn(),
    onSensorAlarm: jest.fn(),
    onTamperDetected: jest.fn(),
    onBatteryLow: jest.fn(),
    onSmokeSubEvent: jest.fn(),
  } : null;
  const alarmDevice = { onAlarmHubZoneEvent: jest.fn() };

  const drivers = {
    protectcamera: { getUnifiDeviceById: () => deviceCamera, onParseWebsocketMessage: jest.fn() },
    protectdoorbell: { getUnifiDeviceById: () => deviceDoorbell, onParseWebsocketMessage: jest.fn() },
    protectsensor: { getUnifiDeviceById: () => deviceSensor },
    'protect-nvr-alarm': { getNVRAlarmDevice: () => alarmDevice },
  };
  const harness = createWebSocketHarness(ProtectWebSocket, drivers);
  return {
    ...harness, drivers, deviceCamera, deviceDoorbell, deviceSensor, alarmDevice,
  };
}

const packet = (type, item) => ({ type, item: { id: 'ev-1', device: 'dev-1', ...item } });

describe('V2 events websocket routing', () => {
  describe('guards', () => {
    test.each([
      ['no item', { type: 'add' }],
      ['item without device', { type: 'add', item: { type: 'motion' } }],
    ])('%s is ignored', (_label, msg) => {
      const s = createSetup();
      s.emit(msg);
      expect(s.deviceCamera.onMotionDetected).not.toHaveBeenCalled();
    });

    test('records last message time', () => {
      const s = createSetup();
      s.emit(packet('add', { type: 'motion', start: 1 }));
      expect(s.ws.getLastWebsocketMessageTime()).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
    });

    test('malformed JSON is ignored and logged, not thrown', () => {
      const s = createSetup();
      expect(() => s.emit('not json')).not.toThrow();
      expect(s.debugLog.some((m) => m.includes('malformed websocket message'))).toBe(true);
      expect(s.ws.getLastWebsocketMessageTime()).toBeNull();
    });

    test('handler error in a device is swallowed and logged', () => {
      const s = createSetup();
      s.deviceCamera.onMotionDetected.mockImplementation(() => {
        throw new Error('boom');
      });
      expect(() => s.emit(packet('add', { type: 'motion', start: 1 }))).not.toThrow();
      expect(s.debugLog.some((m) => m.includes('dispatch error: Error: boom'))).toBe(true);
    });

    test('unknown driver lookup is swallowed', () => {
      const s = createSetup();
      delete s.drivers.protectsensor;
      expect(() => s.emit(packet('add', { type: 'motion', start: 1 }))).not.toThrow();
    });
  });

  describe('ring and motion', () => {
    test('ring add calls doorbell only', () => {
      const s = createSetup();
      s.emit(packet('add', { type: 'ring', start: 111 }));
      expect(s.deviceDoorbell.onDoorbellRinging).toHaveBeenCalledWith(111);
    });

    test('ring update is ignored', () => {
      const s = createSetup();
      s.emit(packet('update', { type: 'ring', start: 111 }));
      expect(s.deviceDoorbell.onDoorbellRinging).not.toHaveBeenCalled();
    });

    test('motion add starts motion on camera and doorbell', () => {
      const s = createSetup();
      s.emit(packet('add', { type: 'motion', start: 5 }));
      expect(s.deviceCamera.onMotionDetected).toHaveBeenCalledWith(5, true);
      expect(s.deviceDoorbell.onMotionDetected).toHaveBeenCalledWith(5, true);
    });

    test('motion update with end stops motion', () => {
      const s = createSetup();
      s.emit(packet('update', { type: 'motion', start: 5, end: 9 }));
      expect(s.deviceCamera.onMotionDetected).toHaveBeenCalledWith(9, false);
    });

    test('motion update without end does nothing', () => {
      const s = createSetup();
      s.emit(packet('update', { type: 'motion', start: 5 }));
      expect(s.deviceCamera.onMotionDetected).not.toHaveBeenCalled();
    });

    test('missing device types are skipped without error', () => {
      const s = createSetup({ camera: false, doorbell: false, sensor: false });
      expect(() => s.emit(packet('add', { type: 'motion', start: 5 }))).not.toThrow();
    });
  });

  describe('smart detection', () => {
    test.each(['smartDetectZone', 'smartDetectLine', 'smartDetectLoiterZone'])('%s is forwarded with detectionMethod', (itemType) => {
      const s = createSetup();
      s.emit(packet('update', {
        type: itemType, smartDetectTypes: ['person'], start: 1, id: 'sd-1',
      }));
      expect(s.drivers.protectcamera.onParseWebsocketMessage).toHaveBeenCalledWith(
        s.deviceCamera,
        {
          smartDetectTypes: ['person'], start: 1, end: null, detectionMethod: itemType,
        },
        'update',
        'sd-1',
      );
      expect(s.drivers.protectdoorbell.onParseWebsocketMessage).toHaveBeenCalled();
    });

    test('closing frame with empty types is still forwarded', () => {
      const s = createSetup();
      s.emit(packet('update', { type: 'smartDetectZone', smartDetectTypes: [], end: 9 }));
      expect(s.drivers.protectcamera.onParseWebsocketMessage).toHaveBeenCalledWith(
        s.deviceCamera,
        expect.objectContaining({ smartDetectTypes: [], end: 9 }),
        'update',
        'ev-1',
      );
    });

    test('empty types without end is ignored', () => {
      const s = createSetup();
      s.emit(packet('add', { type: 'smartDetectZone', smartDetectTypes: [], start: 1 }));
      expect(s.drivers.protectcamera.onParseWebsocketMessage).not.toHaveBeenCalled();
    });

    test('smart audio detection goes to onAudioDetection, allows empty types', () => {
      const s = createSetup();
      s.emit(packet('add', { type: 'smartAudioDetect', start: 1, score: 70 }));
      const expected = {
        smartDetectTypes: [], start: 1, end: null, score: 70,
      };
      expect(s.deviceCamera.onAudioDetection).toHaveBeenCalledWith(expected, 'add', 'ev-1');
      expect(s.deviceDoorbell.onAudioDetection).toHaveBeenCalledWith(expected, 'add', 'ev-1');
    });
  });

  describe('sensor events', () => {
    test('sensorVape', () => {
      const s = createSetup();
      s.emit(packet('update', { type: 'sensorVape', start: 1, end: 2 }));
      expect(s.deviceSensor.onVapeDetected).toHaveBeenCalledWith('update', 1, 2);
    });

    test('sensorExtremeValues reads metric, value and status text', () => {
      const s = createSetup();
      s.emit(packet('add', {
        type: 'sensorExtremeValues',
        metadata: { sensorType: { text: 'co2' }, sensorValue: { text: '1200' }, status: { text: 'high' } },
      }));
      expect(s.deviceSensor.onExtremeValue).toHaveBeenCalledWith('co2', '1200', 'high');
    });

    test('sensorExtremeValues tolerates missing value/status', () => {
      const s = createSetup();
      s.emit(packet('add', { type: 'sensorExtremeValues', metadata: { sensorType: { text: 'aqi' } } }));
      expect(s.deviceSensor.onExtremeValue).toHaveBeenCalledWith('aqi', null, null);
    });

    test('sensorExtremeValues without sensorType is ignored', () => {
      const s = createSetup();
      s.emit(packet('add', { type: 'sensorExtremeValues', metadata: {} }));
      expect(s.deviceSensor.onExtremeValue).not.toHaveBeenCalled();
    });

    test('sensorAlarm passes alarm type, event type and end', () => {
      const s = createSetup();
      s.emit(packet('update', { type: 'sensorAlarm', end: 9, metadata: { alarmType: { text: 'smoke' } } }));
      expect(s.deviceSensor.onSensorAlarm).toHaveBeenCalledWith('smoke', 'update', 9);
    });

    test('sensorAlarm without alarmType is ignored', () => {
      const s = createSetup();
      s.emit(packet('add', { type: 'sensorAlarm', metadata: {} }));
      expect(s.deviceSensor.onSensorAlarm).not.toHaveBeenCalled();
    });

    // Regression for #56: the clearing frame (update + end) must reach the sensor.
    test.each([
      ['add', { start: 1 }, [1, null]],
      ['update', { start: 1, end: 2 }, [1, 2]],
    ])('sensorTamper %s is forwarded', (eventType, extra, args) => {
      const s = createSetup();
      s.emit(packet(eventType, { type: 'sensorTamper', ...extra }));
      expect(s.deviceSensor.onTamperDetected).toHaveBeenCalledWith(...args);
    });

    test('sensorTamper update without end is ignored', () => {
      const s = createSetup();
      s.emit(packet('update', { type: 'sensorTamper', start: 1 }));
      expect(s.deviceSensor.onTamperDetected).not.toHaveBeenCalled();
    });

    test('sensorBatteryLow only on add', () => {
      const s = createSetup();
      s.emit(packet('update', { type: 'sensorBatteryLow' }));
      expect(s.deviceSensor.onBatteryLow).not.toHaveBeenCalled();
      s.emit(packet('add', { type: 'sensorBatteryLow' }));
      expect(s.deviceSensor.onBatteryLow).toHaveBeenCalledTimes(1);
    });

    test.each([
      'sensorSmokeFault', 'sensorCoFault', 'sensorSmokeEndOfLife',
      'sensorSmokeBatteryLow', 'sensorSmokeNeedsCleaning', 'sensorSmokeTest',
    ])('smoke sub-event %s', (itemType) => {
      const s = createSetup();
      s.emit(packet('update', { type: itemType, end: 7 }));
      expect(s.deviceSensor.onSmokeSubEvent).toHaveBeenCalledWith(itemType, 'update', 7);
    });
  });

  describe('NFC / fingerprint / fob / alarm hub', () => {
    test.each(['nfcCardScanned', 'fingerprintIdentified'])('%s goes to doorbell and camera drivers', (itemType) => {
      const s = createSetup();
      s.emit(packet('add', { type: itemType, start: 1, metadata: { x: 1 } }));
      const payload = {
        type: itemType, start: 1, end: null, metadata: { x: 1 },
      };
      expect(s.drivers.protectdoorbell.onParseWebsocketMessage).toHaveBeenCalledWith(s.deviceDoorbell, payload, 'add', 'ev-1');
      expect(s.drivers.protectcamera.onParseWebsocketMessage).toHaveBeenCalledWith(s.deviceCamera, payload, 'add', 'ev-1');
    });

    test('sensorButtonPressed is adapted to the V1 packet shape for the fob pipeline', () => {
      const s = createSetup();
      s.emit(packet('add', {
        type: 'sensorButtonPressed', start: 1, metadata: { deviceModelKey: 'fob' },
      }));
      expect(s.homey.app.onFobWebsocketMessage).toHaveBeenCalledWith({
        action: { modelKey: 'event', action: 'add', id: 'ev-1' },
        payload: {
          type: 'sensorButtonPressed', device: 'dev-1', start: 1, end: undefined, metadata: { deviceModelKey: 'fob' },
        },
      });
    });

    test.each(['alarmHubMotion', 'alarmHubTamper', 'alarmHubBatteryConnected'])('%s goes to the NVR alarm device', (itemType) => {
      const s = createSetup();
      s.emit(packet('add', { type: itemType }));
      expect(s.alarmDevice.onAlarmHubZoneEvent).toHaveBeenCalledWith(itemType, expect.objectContaining({ type: itemType }));
    });

    test('alarm hub event without alarm driver installed does not throw', () => {
      const s = createSetup();
      delete s.drivers['protect-nvr-alarm'];
      expect(() => s.emit(packet('add', { type: 'alarmHubMotion' }))).not.toThrow();
    });
  });
});
