'use strict';

/**
 * UA Hub Gate multi-button control (Access API 7.9, `control_cmd`, UniFi Access 4.2.16+).
 *
 * The API reference documents `control_cmd` for the hub's "Three-Button Control
 * (Open, Stop and Close)" mode. On UniFi Access 4.3.22 it was also verified to work in
 * "Two-Button Control (Open and Close)" for open/close. In single-button mode the hub has
 * one action, so this stays opt-in per device and must match the hub's Gate Control Mode.
 */

const C = require('./constants');

/** Device-view button capability → control_cmd it sends. */
const GATE_BUTTONS = Object.freeze({
  [C.CAPABILITY_GATE_OPEN_BUTTON]: C.ACCESS_CONTROL_CMD_OPEN,
  [C.CAPABILITY_GATE_STOP_BUTTON]: C.ACCESS_CONTROL_CMD_STOP,
  [C.CAPABILITY_GATE_CLOSE_BUTTON]: C.ACCESS_CONTROL_CMD_CLOSE,
});

// Display order follows the UniFi Access app: Open | Stop | Close.
const BUTTONS_BY_MODE = Object.freeze({
  [C.GATE_MODE_TWO_BUTTON]: [C.CAPABILITY_GATE_OPEN_BUTTON, C.CAPABILITY_GATE_CLOSE_BUTTON],
  [C.GATE_MODE_THREE_BUTTON]: [C.CAPABILITY_GATE_OPEN_BUTTON, C.CAPABILITY_GATE_STOP_BUTTON, C.CAPABILITY_GATE_CLOSE_BUTTON],
});

/** True for the modes where the hub has separate Open and Close outputs. */
function isMultiButton(mode) {
  return mode === C.GATE_MODE_TWO_BUTTON || mode === C.GATE_MODE_THREE_BUTTON;
}

/** Button capabilities the device should have in this mode (unknown/missing = single). */
function buttonsForMode(mode) {
  return BUTTONS_BY_MODE[mode] ? [...BUTTONS_BY_MODE[mode]] : [];
}

/**
 * control_cmd for the garagedoor_closed toggle, or null to send a plain unlock pulse.
 * Homey passes the requested state: true = "make it closed", false = "make it open".
 */
function toggleCommand(mode, requestedClosed) {
  if (!isMultiButton(mode)) return null;
  return requestedClosed ? C.ACCESS_CONTROL_CMD_CLOSE : C.ACCESS_CONTROL_CMD_OPEN;
}

module.exports = {
  GATE_BUTTONS,
  isMultiButton,
  buttonsForMode,
  toggleCommand,
};
