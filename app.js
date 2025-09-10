// eslint-disable-next-line node/no-unpublished-require,strict

'use strict';

const Homey = require('homey');
const { Log } = require('homey-log');
const ProtectAPI = require('./library/protectapi');
const UfvConstants = require('./library/constants');
const AccessAPI = require('./library/access-api-v2/access-api');

// 2700000 miliseconds is 45 minutes
const RefreshCookieTime = 2700000;

class UniFiProtect extends Homey.App {
  /**
     * onInit is called when the app is initialized.
     */
  async onInit() {
    this.homeyLog = new Log({ homey: this.homey });
    this.debuggedIn = false;
    this.nvrIp = null;
    this.nvrPort = null;
    this.nvrUsername = null;
    this.nvrPassword = null;
    this.useCameraSnapshot = false;
    this.ignoreEventsNfcFingerprint = 5; // seconds
    this.ignoreEventsDoorbell = 5; // seconds
    this._refreshAuthTokensnterval = 60 * 60 * 1000; // 1 hour
    this.lastDoorAccessEvent = null;

    // Single API instance for all devices
    this.api = new ProtectAPI();
    this.api.setHomeyObject(this.homey);
    //
    this.accessApi = new AccessAPI();
    this.accessApi.setHomeyObject(this.homey);

    // Register snapshot image token
    this._registerSnapshotToken();

    this._snapshotTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SNAPSHOT_CREATED);
    this._packageSnapshotTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_PACKAGE_SNAPSHOT_CREATED);
    this._connectionStatusTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_CONNECTION_CHANGED);
    this._doorbellRingingTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_DOORBELL_RINGING);
    this._smartDetectionTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION);
    this._smartDetectionTriggerPerson = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_PERSON);
    this._smartDetectionTriggerVehicle = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_VEHICLE);
    this._smartDetectionTriggerAnimal = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_ANIMAL);
    this._smartDetectionTriggerPackage = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_PACKAGE);
    this._smartDetectionTriggerLicensePlate = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_LICENSEPLATE);
    this._smartDetectionTriggerFace = this.homey.flow.getTriggerCard(UfvConstants.EVENT_SMART_DETECTION_FACE);
    this._fingerPrintIdentifiedTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_FINGERPRINT_IDENTIFIED);
    this._doorAccessTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_DOOR_ACCESS);
    this._nfcCardScannedTrigger = this.homey.flow.getTriggerCard(UfvConstants.EVENT_NFC_CARD_SCANNED);

    const _actionTakeSnapshot = this.homey.flow.getActionCard(UfvConstants.ACTION_TAKE_SNAPSHOT);
    _actionTakeSnapshot.registerRunListener(async (args, state) => {
      if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
        // Get device from camera id
        const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
        if (device) {
          device._createSnapshotImage(true);
        }
      }
      return Promise.resolve(true);
    });

    const _setRecordingMode = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_RECORDING_MODE);
    _setRecordingMode.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.api.setRecordingMode(args.device.getData(), args.recording_mode);
      }
      return Promise.resolve(true);
    });

    // V2 Actions
    const _actionTakeSnapshotV2 = this.homey.flow.getActionCard(UfvConstants.ACTION_TAKE_SNAPSHOT_V2);
    _actionTakeSnapshotV2.registerRunListener(async (args, state) => {
      if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
        // Get device from camera id
        const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
        if (device) {
          device._createSnapshotImage(true);
        }
      }
      return Promise.resolve(true);
    });

    const _setRecordingModeV2 = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_RECORDING_MODE_V2);
    _setRecordingModeV2.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.api.setRecordingMode(args.device.getData(), args.recording_mode);
      }
      return Promise.resolve(true);
    });

    const _setChimeVolume = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_CHIME_ONOFF);
    _setChimeVolume.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        let volume = 0;
        if (args.enabled) {
          volume = args.volume;
        }
        return this.homey.app.api.setChimeVolume(args.device.getData(), volume);
      }
      return Promise.resolve(true);
    });

    const _setNightVisionMode = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_NIGHT_VISION_MODE);
    _setNightVisionMode.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.api.setNightVisionMode(args.device.getData(), args.nightvision_mode);
      }
      return Promise.resolve(true);
    });

    const _setLCDMessage = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_LCD_MESSAGE);
    _setLCDMessage.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        this.homey.app.api.setLCDMessage(args.device.getData(), args.message.substring(0, 29))
          .then(this.homey.app.debug.bind(this, '[lcd_message.set]'))
          .catch(this.error.bind(this, '[lcd_message.set]'));
      }
      return Promise.resolve(true);
    });

    const _setCameraStatusLed = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_CAMERA_STATUS_LED);
    _setCameraStatusLed.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.api.setStatusLed(args.device.getData(), args.enabled);
      }
      return Promise.resolve(true);
    });

    const _setDoorbellStatusLed = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DOORBELL_STATUS_LED);
    _setDoorbellStatusLed.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.api.setStatusLed(args.device.getData(), args.enabled);
      }
      return Promise.resolve(true);
    });

    const _setDoorbellStatusSound = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DOORBELL_STATUS_SOUND);
    _setDoorbellStatusSound.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.api.setStatusSound(args.device.getData(), args.enabled);
      }
      return Promise.resolve(true);
    });

    const _setDeviceCameraStatusLed = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_CAMERA_STATUS_LED);
    _setDeviceCameraStatusLed.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.api.setStatusLed(args.device.getData(), args.enabled);
      }
      return Promise.resolve(true);
    });

    const _setDeviceDoorbellStatusLed = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_DOORBELL_STATUS_LED);
    _setDeviceDoorbellStatusLed.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.api.setStatusLed(args.device.getData(), args.enabled);
      }
      return Promise.resolve(true);
    });

    const _setDeviceDoorbellStatusSound = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_DOORBELL_STATUS_SOUND);
    _setDeviceDoorbellStatusSound.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.api.setStatusSound(args.device.getData(), args.enabled);
      }
      return Promise.resolve(true);
    });

    const _actionTakePackageSnapshot = this.homey.flow.getActionCard(UfvConstants.ACTION_TAKE_PACKAGE_SNAPSHOT);
    _actionTakePackageSnapshot.registerRunListener(async (args, state) => {
      if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
        // Get device from camera id
        const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
        if (device) {
          return device._createSnapshotPackageImage(true);
        }
      }
      return Promise.reject(new Error('No device found'));
    });

    const _actionSetCameraBlackout = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_CAMERA_BLACKOUT);
    _actionSetCameraBlackout.registerRunListener(async (args, state) => {
      if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
        this.debug(`Set Camera Blackout ${args.device.getData().id} to ${args.enabled}`);
        // Get device from camera id
        const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
        if (device) {
          this.debug(`Found device ${device.getName()}`);
          return this.homey.app.api.setCameraBlackout(device.getData(), args.enabled).catch(this.error);
        }
      }
      return Promise.reject(new Error('No device found'));
    });

    const _actionSetDoorbellBlackout = this.homey.flow.getActionCard(UfvConstants.ACTION_SET_DEVICE_DOORBELL_BLACKOUT);
    _actionSetDoorbellBlackout.registerRunListener(async (args, state) => {
      if (typeof args.device.getData === 'function' && typeof args.device.getData().id !== 'undefined') {
        // Get device from camera id
        const device = args.device.driver.getUnifiDeviceById(args.device.getData().id);
        if (device) {
          return this.homey.app.api.setCameraBlackout(device.getData(), args.enabled);
        }
      }
      return Promise.reject('No device found');
    });

    const _setReaderAccessMethodWaveConfig = this.homey.flow.getActionCard('ufv_set_reader_access_method_wave');
    _setReaderAccessMethodWaveConfig.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.accessApi.setReaderWave(args.device.getData().id, args.enabled);
      }
      return Promise.resolve(true);
    });
    const _setReaderAccessMethodNGCConfig = this.homey.flow.getActionCard('ufv_set_reader_access_method_nfc');
    _setReaderAccessMethodNGCConfig.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.accessApi.setReaderNFC(args.device.getData().id, args.enabled);
      }
      return Promise.resolve(true);
    });
    const _setReaderAccessMethodMobileButtonConfig = this.homey.flow.getActionCard('ufv_set_reader_access_method_bt-button');
    _setReaderAccessMethodMobileButtonConfig.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.accessApi.setReaderMobileButton(args.device.getData().id, args.enabled);
      }
      return Promise.resolve(true);
    });
    const _setReaderAccessMethodMobileTapConfig = this.homey.flow.getActionCard('ufv_set_reader_access_method_bt-tap');
    _setReaderAccessMethodMobileTapConfig.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.accessApi.setReaderMobileTap(args.device.getData().id, args.enabled);
      }
      return Promise.resolve(true);
    });
    const _setDoorTempLockingRule = this.homey.flow.getActionCard('ufv_set_reader_door_locking_rule');
    _setDoorTempLockingRule.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.accessApi.setTempDoorLockingRule(args.device.getData().id, args.type, args.interval);
      }
      return Promise.resolve(true);
    });
    const _setGarageDoorTempLockingRule = this.homey.flow.getActionCard('ufv_set_reader_garagedoor_locking_rule');
    _setGarageDoorTempLockingRule.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.accessApi.setTempDoorLockingRule(args.device.getData().id, args.type, args.interval);
      }
      return Promise.resolve(true);
    });
    const _setDoorUnlock = this.homey.flow.getActionCard('ufv_set_reader_door_unlock');
    _setDoorUnlock.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.accessApi.setDoorUnLock(args.device.getData().id);
      }
      return Promise.resolve(true);
    });
    const _setGarageDoorUnlock = this.homey.flow.getActionCard('ufv_set_reader_garagedoor_unlock');
    _setGarageDoorUnlock.registerRunListener(async (args, state) => {
      if (typeof args.device.getData().id !== 'undefined') {
        return this.homey.app.accessApi.setDoorUnLock(args.device.getData().id);
      }
      return Promise.resolve(true);
    });

    // Subscribe to credentials updates
    this.homey.settings.on('set', (key) => {
      if (key === 'ufp:credentials' || key === 'ufp:nvrip' || key === 'ufp:nvrport') {
        this._appLogin();
      }
      if (key === 'ufp:settings') {
        const settings = this.homey.settings.get('ufp:settings');
        this.useCameraSnapshot = settings.useCameraSnapshot;
        this.ignoreEventsNfcFingerprint = settings.ignoreEventsNfcFingerprint || 5;
        this.ignoreEventsDoorbell = settings.ignoreEventsDoorbell || 5;
      }
    });

    // set settings
    const settings = this.homey.settings.get('ufp:settings');
    if (settings) {
      this.useCameraSnapshot = settings.useCameraSnapshot;
      this.ignoreEventsNfcFingerprint = settings.ignoreEventsNfcFingerprint || 5;
      this.ignoreEventsDoorbell = settings.ignoreEventsDoorbell || 5;
    }

    this.homey.settings.on('set', (key) => {
      if (key === 'ufp:tokens') {
        this.loginToAccess().catch(this.error);
      }
    });

    const tokens = this.homey.settings.get('ufp:tokens');
    if (tokens) {
      this.accessApiKey = tokens.accessApiKey;
    }

    if (tokens && typeof tokens.accessApiKey !== 'undefined' && tokens.accessApiKey !== '') {
      this.loginToAccess().catch(this.error);
    }

    this._appLogin();
    // refresh auth tokens every hour
    await this.refreshAuthTokens();

    this.debug('UniFiProtect has been initialized');
  }

  async loginToAccess() {
    // Validate NVR IP address
    const nvrip = this.homey.settings.get('ufp:nvrip');
    if (!nvrip) {
      this.log('NVR IP address not set.');
      return;
    }

    // Setting NVR Port when set
    // const nvrport = this.homey.settings.get('ufp:nvrport');

    // Validate NVR credentials
    const tokens = this.homey.settings.get('ufp:tokens');
    if (!tokens) {
      this.log('Tokens not set.');
      return;
    }

    this.accessApi.setSettings(nvrip, 12445, tokens.accessApiKey);

    this.accessApi.websocket.reconnectNotificationsListener();

    this.accessApi.loggedInStatus = 'Connected';
  }

  async refreshAuthTokens() {
    const refreshAuthTokens = setInterval(() => {
      try {
        this.debug('Refreshing auth tokens');
        this._appLogin();
      } catch (error) {
        this.homey.error(`${JSON.stringify(error)}`);
      }
    }, this._refreshAuthTokensnterval);
  }

  async triggerSnapshotTrigger(tokens) {
    await this._snapshotTrigger
      .trigger(tokens)
      .catch(this.error);
  }

  async triggerConnectionStatusTrigger(tokens) {
    await this._connectionStatusTrigger
      .trigger(tokens)
      .then(this.debug)
      .catch(this.error);
  }

  async triggerDoorbellRingingTrigger(tokens) {
    await this._doorbellRingingTrigger
      .trigger(tokens)
      .then(this.debug)
      .catch(this.error);
  }

  async triggerSmartDetectionTrigger(tokens) {
    await this._smartDetectionTrigger
      .trigger(tokens)
      .then(this.debug)
      .catch(this.error);
  }

  _registerSnapshotToken() {
    // Register snapshot image token
    this.homey.flow.createToken('ufv_snapshot', {
      type: 'image',
      title: 'Snapshot',
    });
  }

  _appLogin() {
    this.debug('Logging in...');

    // Validate NVR IP address
    const nvrip = this.homey.settings.get('ufp:nvrip');
    if (!nvrip) {
      this.debug('NVR IP address not set.');
      return;
    }

    // Setting NVR Port when set
    const nvrport = this.homey.settings.get('ufp:nvrport');

    // Validate NVR credentials
    const credentials = this.homey.settings.get('ufp:credentials');
    if (!credentials) {
      this.debug('Credentials not set.');
      return;
    }

    // Log in to NVR
    this.api.login(nvrip, nvrport, credentials.username, credentials.password)
      .then(() => {
        this.api.getBootstrapInfo()
          .then(() => {
            this.debug('Bootstrap loaded.');
            this.debuggedIn = true;
            this.nvrIp = nvrip;
            this.nvrPort = nvrport;
            this.nvrUsername = credentials.username;
            this.nvrPassword = credentials.password;

            // _refreshCookie after 45 minutes
            const timeOutFunction = function() {
              this._refreshCookie();
            }.bind(this);
            this.homey.setTimeout(timeOutFunction, RefreshCookieTime);

            this.debug('Logged in.');
          })
          .catch((error) => this.error(error));
      })
      .catch((error) => this.error(error));
  }

  cleanDeviceStorage() {
    const driverDoorbell = this.homey.drivers.getDriver('protectdoorbell');
    const driverCamera = this.homey.drivers.getDriver('protectcamera');

    driverDoorbell.getDevices().forEach((device) => {
      device.cleanSmartDetectionEvents();
    });

    driverCamera.getDevices().forEach((device) => {
      device.cleanSmartDetectionEvents();
    });

  }

  _refreshCookie() {
    // if (this.debuggedIn) {
    this.api._lastUpdateId = null;

    // Validate NVR IP address
    const nvrip = this.homey.settings.get('ufp:nvrip');
    if (!nvrip) {
      this.debug('NVR IP address not set.');
      return;
    }

    // Setting NVR Port when set
    const nvrport = this.homey.settings.get('ufp:nvrport');

    // Validate NVR credentials
    const credentials = this.homey.settings.get('ufp:credentials');
    if (!credentials) {
      this.debug('Credentials not set.');
      return;
    }

    this.api.login(nvrip, nvrport, credentials.username, credentials.password)
      .then(() => {
        this.debug('Logged in again to refresh cookie.');
        this.api.getBootstrapInfo()
          .then(() => {
            this.debug('Bootstrap loaded.');
            this.debuggedIn = true;
          })
          .catch((error) => this.error(error));
      })
      .catch((error) => this.error(error));
    // }

    // clean Device Storage
    this.cleanDeviceStorage();

    // _refreshCookie after 1 hour
    const timeOutFunction = function() {
      this._refreshCookie();
    }.bind(this);
    this.homey.setTimeout(timeOutFunction, RefreshCookieTime);
  }

  /**
     * Convert a Homey time to a local time
     * @param {Date} homeyTime
     * @returns {Date}
     */
  toLocalTime(homeyTime) {
    const tz = this.homey.clock.getTimezone();
    const localTime = new Date(homeyTime.toLocaleString('en-US', { timeZone: tz }));
    return localTime;
  }

  getUnixTimestamp() {
    return Math.floor(Date.now());
  }

  onDoorAccess(payload) {
    this.homey.app.debug(`[APP] onDoorAccess ${JSON.stringify(payload)}`);

    if (typeof payload !== 'undefined'
            && typeof payload.type !== 'undefined'
            && payload.type === 'doorAccess'
            && typeof payload.metadata !== 'undefined'
            && typeof payload.metadata.uniqueId !== 'undefined'
            && payload.metadata.uniqueId !== null) {
      if (!this.lastDoorAccessEvent || (this.getUnixTimestamp() - this.lastDoorAccessEvent) > (this.ignoreEventsNfcFingerprint * 1000)) {
        this.homey.app.api.getCloudUserById(payload.metadata.uniqueId).then((user) => {
          // Generic trigger
          if (user) {
            this.homey.app._doorAccessTrigger.trigger({
              ufp_door_access_person: (user.email !== '' ? user.email : user.username),
              ufp_door_access_first_name: user.first_name,
              ufp_door_access_last_name: user.last_name,
              ufp_door_access_user_unique_id: user.unique_id,
              ufp_door_access_direction: payload.metadata.direction,
              ufp_door_access_door_name: payload.metadata.doorName,
            }).catch(this.error);
          }
        }).catch(this.error);
        return true;
      }
    }

    this.homey.app.debug('DoorAccess event is not valid!');
    return false;
  }

  onParseWebsocketMessage(payload) {
    if (payload.hasOwnProperty('type')) {

      if (payload.type === 'doorAccess') {
        this.onDoorAccess(payload);
      }

    }
  }

  debug() {
    if (Homey.env.DEBUG === 'true') {
      const args = Array.prototype.slice.call(arguments);
      args.unshift('[debug]');
      this.homey.log(args.join(' '));
    }
  }
}

module.exports = UniFiProtect;
