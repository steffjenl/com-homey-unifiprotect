'use strict';

const Homey = require('homey');

class UniFiSensorDriver extends Homey.Driver {
  /**
     * onInit is called when the driver is initialized.
     */
  async onInit() {
    this.homey.app.debug('UniFiSensor Driver has been initialized');
  }

  onPair(session) {
    const { homey } = this;
    session.setHandler('validate', async (data) => {
      const nvrip = homey.settings.get('ufp:nvrip') || homey.app.getV2Connection().host;
      return (nvrip ? 'ok' : 'nok:protect');
    });

    session.setHandler('list_devices', async (data) => {
      let sensors;
      if (homey.app.isV1Available()) {
        sensors = await homey.app.api.getSensors().catch(() => ({}));
        if (Object.keys(sensors || {}).length === 0 && homey.app.isV2Available()) {
          homey.app.debug('[protectsensor] V1 returned no sensors, falling back to V2');
          sensors = await homey.app.apiV2.getSensors();
        }
      } else if (homey.app.isV2Available()) {
        sensors = await homey.app.apiV2.getSensors();
      } else {
        homey.app.debug('[protectsensor] No API available for listing sensors');
        return [];
      }
      return Object.values(sensors).map((sensor) => {
        return {
          data: { id: String(sensor.id) },
          name: sensor.name,
        };
      });
    });
  }

  async onRepair(session, device) {
    const { homey } = this;

    session.setHandler('get_repair_data', async () => {
      const v2Conn = homey.app.getV2Connection();
      const nvrip = homey.settings.get('ufp:nvrip');
      const tokens = homey.settings.get('ufp:tokens') || {};
      const isV2 = !!(tokens.protectV2ApiKey);
      const host = v2Conn.host || nvrip || '';
      const port = v2Conn.port || 443;
      const connected = homey.app.isControllerReachable(isV2 ? 'v2' : 'v1');
      let status = 'Disconnected';
      if (isV2) {
        if (homey.app.apiV2 && homey.app.apiV2.websocket) status = homey.app.apiV2.websocket.loggedInStatus;
      } else if (homey.app.api) {
        status = homey.app.api.loggedInStatus;
      }

      return {
        deviceName: device ? device.getName() : 'UniFi Protect',
        apiType: 'protect',
        host,
        port,
        isV2,
        apiKey: tokens.protectV2ApiKey || '',
        connected,
        status,
      };
    });

    session.setHandler('save_repair_data', async (data) => {
      try {
        const { host } = data;
        const port = data.port || '443';
        const { token } = data;

        const tokens = homey.settings.get('ufp:tokens') || {};
        if (token) {
          tokens.protectV2ApiKey = token;
          homey.settings.set('ufp:tokens', tokens);
        }

        homey.settings.set('ufp:v2nvr', { nvrip: host, nvrport: port });
        homey.settings.set('ufp:nvrip', host);
        homey.settings.set('ufp:nvrport', port);

        if (tokens.protectV2ApiKey) {
          homey.app._initProtectV2Stack();
          await homey.app.appProtect.loginToProtectV2();
        } else {
          homey.app.appProtect._appLogin();
        }

        if (device) {
          await device.setAvailable().catch(homey.error);
          if (typeof device.initDevice === 'function') {
            await device.initDevice().catch(homey.error);
          }
        }

        return { status: 'ok', message: 'Connection restored' };
      } catch (error) {
        homey.app.debug(`[onRepair] save_repair_data error: ${error}`);
        return { status: 'failure', error: error.message || String(error) };
      }
    });

    session.setHandler('validate', async () => {
      return 'ok';
    });
  }

  async repair(session, device) {
    return this.onRepair(session, device);
  }

  onParseWebsocketMessage(sensor, payload) {
    if (Object.prototype.hasOwnProperty.call(sensor, '_events')) {
      if (Object.prototype.hasOwnProperty.call(payload, 'stats') && Object.prototype.hasOwnProperty.call(payload.stats, 'temperature')) {
        sensor.onTemperatureChange(payload.stats.temperature.value);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'stats') && Object.prototype.hasOwnProperty.call(payload.stats, 'humidity')) {
        sensor.onHumidityChange(payload.stats.humidity.value);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'stats') && Object.prototype.hasOwnProperty.call(payload.stats, 'light')) {
        sensor.onLightChange(payload.stats.light.value);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'isOpened')) {
        sensor.onDoorChange(payload.isOpened);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'motionDetectedAt')) {
        sensor.onMotionDetected(payload.motionDetectedAt, payload.isMotionDetected);
      }

      // UP-AirQuality: continuous readings + battery/smoke status, not documented in the
      // official v2 OpenAPI spec but confirmed present on real device bootstrap/updates.
      if (Object.prototype.hasOwnProperty.call(payload, 'airQuality')) {
        sensor.onAirQualityChange(payload.airQuality);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'batteryStatus')) {
        sensor.onBatteryStatusChange(payload.batteryStatus);
      }

      if (Object.prototype.hasOwnProperty.call(payload, 'smokeStatus')) {
        sensor.onSmokeStatusChange(payload.smokeStatus);
      }

      sensor.refreshSensorData();
    }
  }

  getUnifiDeviceById(deviceId) {
    try {
      const devices = this.getDevices();
      const device = devices.find((device) => String(device.getData().id) === String(deviceId));
      if (!device) return false;
      return device;
    } catch (Error) {
      return false;
    }
  }
}

module.exports = UniFiSensorDriver;
