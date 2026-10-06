'use strict';

const ANY_ZONE_ID = 'any';

/**
 * Run listener for device smart detection triggers with the optional `zone` argument.
 * Flows created before the argument existed have no zone set: they match every zone.
 * state.zone_ids comes from SmartDetectionMixin (V1 only: V2 sends no zone metadata).
 */
function matchesZone(args, state) {
  if (!args || !args.zone || String(args.zone.id) === ANY_ZONE_ID) {
    return true;
  }
  const zoneIds = (state && Array.isArray(state.zone_ids)) ? state.zone_ids : [];
  return zoneIds.map(String).includes(String(args.zone.id));
}

/**
 * Autocomplete results for the `zone` argument: "any zone" + the camera's own zone names.
 */
function listZones(homey, device, query) {
  const needle = String(query || '').toLowerCase();
  const zones = (device && Array.isArray(device._smartDetectZones)) ? device._smartDetectZones : [];
  const results = [{ id: ANY_ZONE_ID, name: homey.__('flow.any_zone') }];
  for (const zone of zones) {
    const name = zone.name || String(zone.id);
    results.push({ id: String(zone.id), name });
  }
  return results.filter((result) => result.name.toLowerCase().includes(needle));
}

/**
 * Register run + autocomplete listeners on a list of device trigger cards.
 */
function registerZoneListeners(homey, cards) {
  for (const card of cards) {
    card.registerRunListener(async (args, state) => matchesZone(args, state));
    card.registerArgumentAutocompleteListener('zone', async (query, args) => listZones(homey, args.device, query));
  }
}

module.exports = {
  ANY_ZONE_ID, matchesZone, listZones, registerZoneListeners,
};
