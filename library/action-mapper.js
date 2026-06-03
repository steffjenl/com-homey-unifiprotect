'use strict';

const BaseClass = require('./baseclass');

class FobActionMapper extends BaseClass {
  constructor(dependencies = {}) {
    super();
    this._setArmMode = dependencies.setArmMode || (async () => true);
    this._triggerAlarm = dependencies.triggerAlarm || (async () => true);
    this._customAction = dependencies.customAction || (async () => true);
    this._sendSpeakerMessage = dependencies.sendSpeakerMessage || (async () => true);
  }

  async handleEvent(event) {
    if (!event || event.type !== 'fob.button') {
      return false;
    }

    const pressType = event.pressType || 'press';

    // Base actions for standard presses.
    const fobActions = {
      arm: async () => this._setArmMode('away'),
      disarm: async () => this._setArmMode('disabled'),
      panic: async () => this._triggerAlarm({ source: 'fob', pressType }),
      night: async () => this._setArmMode('night'),
      left: async () => this._customAction('left', event),
      right: async () => this._customAction('right', event),
    };

    const longPressActions = {
      arm: async () => this._setArmMode('away'),
      disarm: async () => this._setArmMode('disabled'),
      panic: async () => this._triggerAlarm({ source: 'fob', pressType: 'longPress', escalated: true }),
      night: async () => this._setArmMode('night'),
      left: async () => this._customAction('left_long', event),
      right: async () => this._customAction('right_long', event),
    };

    const doublePressActions = {
      arm: async () => this._setArmMode('away'),
      disarm: async () => this._setArmMode('disabled'),
      panic: async () => this._triggerAlarm({ source: 'fob', pressType: 'doublePress', escalated: true }),
      night: async () => this._setArmMode('night'),
      left: async () => this._customAction('left_double', event),
      right: async () => this._customAction('right_double', event),
    };

    const byPressType = {
      press: fobActions,
      longPress: longPressActions,
      doublePress: doublePressActions,
    };

    const actionMap = byPressType[pressType] || fobActions;
    const action = actionMap[event.button];

    if (!action) {
      this.homey.app.debug('[FobActionMapper] No action mapped for button=' + event.button + ' pressType=' + pressType);
      return false;
    }

    await action();
    await this._sendDefaultSpeakerFeedback(event);

    return true;
  }

  async _sendDefaultSpeakerFeedback(event) {
    if (event.button === 'panic') {
      const options = event.pressType === 'press' ? { volume: 100, repeat: 2 } : { volume: 100, repeat: 3 };
      await this._sendSpeakerMessage('Alarm triggered', options);
      return;
    }

    if (event.button === 'arm') {
      await this._sendSpeakerMessage('System armed');
      return;
    }

    if (event.button === 'disarm') {
      await this._sendSpeakerMessage('System disarmed');
      return;
    }

    if (event.button === 'night') {
      await this._sendSpeakerMessage('Night mode armed');
    }
  }
}

module.exports = FobActionMapper;

