'use strict';

const DOOR_STATE_OPEN = 'open';
const DOOR_STATE_CLOSED = 'closed';
const DOOR_STATE_UNKNOWN = 'unknown';

/**
 * Normalise a UniFi Access door position value.
 *
 * `state.dps` (websocket, e.g. `access.data.v2.location.update`) and `door_position_status`
 * (REST, e.g. `GET /doors/:id`) share the same vocabulary: 'open', 'close'/'closed', or 'none'.
 *
 * UA Gate Hubs (and UA Access Hubs) toggle a lock relay, and separately report door position
 * from a reed switch on a different set of contacts. When no such sensor is wired up, the API
 * reports `dps: 'none'` with `dps_connected: false` — that is an unknown state, not "closed".
 * Treating it as closed is what causes the "Opened" trigger to fire on both open and close.
 *
 * @param {string} raw the raw dps / door_position_status value
 * @param {boolean} [dpsConnected] whether a door position sensor is actually wired up
 * @returns {'open'|'closed'|'unknown'}
 */
function normalizeDoorState(raw, dpsConnected) {
  if (dpsConnected === false) {
    return DOOR_STATE_UNKNOWN;
  }

  switch (raw) {
    case 'open':
      return DOOR_STATE_OPEN;
    case 'close':
    case 'closed':
      return DOOR_STATE_CLOSED;
    default:
      return DOOR_STATE_UNKNOWN;
  }
}

module.exports = {
  DOOR_STATE_OPEN,
  DOOR_STATE_CLOSED,
  DOOR_STATE_UNKNOWN,
  normalizeDoorState,
};
