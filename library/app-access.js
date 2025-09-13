'use strict';

const BaseClass = require('./baseclass');

class AppAccess extends BaseClass {

  async onInit() {
    this.homey.app.debug('AppAccess onInit');
    await this.registerFlowAndActionCards();
  }

  async registerFlowAndActionCards() {

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

    this.homey.app.accessApi.setSettings(nvrip, 12445, tokens.accessApiKey);

    this.homey.app.accessApi.websocket.reconnectNotificationsListener();

    this.homey.app.accessApi.loggedInStatus = 'Connected';
  }

  onDoorAccess(payload) {
    this.homey.app.debug(`[APP] onDoorAccess ${JSON.stringify(payload)}`);

    if (typeof payload !== 'undefined'
            && typeof payload.type !== 'undefined'
            && payload.type === 'doorAccess'
            && typeof payload.metadata !== 'undefined'
            && typeof payload.metadata.uniqueId !== 'undefined'
            && payload.metadata.uniqueId !== null
            && payload.metadata.uniqueId !== '') {
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
      this.homey.app.debug('DoorAccess event ignored to prevent duplicates!');
    }

    this.homey.app.debug('DoorAccess event is not valid!');
    return false;
  }

}

module.exports = AppAccess;
