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
 * Zones of the device's camera. Prefers the live V1 bootstrap (zones added or renamed after the
 * device started show up), falls back to the snapshot taken at device init.
 */
function getCameraZones(homey, device) {
  try {
    if (device && homey.app && homey.app.isV1Available()) {
      const bootstrap = homey.app.api.getBootstrap();
      const { id } = device.getData();
      const camera = bootstrap && Array.isArray(bootstrap.cameras)
        && bootstrap.cameras.find((c) => String(c.id) === String(id));
      if (camera && Array.isArray(camera.smartDetectZones) && camera.smartDetectZones.length > 0) {
        return camera.smartDetectZones;
      }
    }
  } catch (e) {
    homey.app.debug(`[Zone] bootstrap zones unavailable: ${e}`);
    // Bootstrap not ready: use the init snapshot.
  }
  return (device && Array.isArray(device._smartDetectZones)) ? device._smartDetectZones : [];
}

/**
 * Autocomplete results for the `zone` argument: "any zone" + the camera's own zone names.
 * Without zones (V2 API key only: the V2 API exposes no detection zones) "any zone" gets a hint.
 */
function listZones(homey, device, query) {
  const needle = String(query || '').toLowerCase();
  const zones = getCameraZones(homey, device);
  const anyZone = { id: ANY_ZONE_ID, name: homey.__('flow.any_zone') };
  if (zones.length === 0) {
    anyZone.description = homey.__('flow.zones_need_v1');
  }
  const results = [anyZone];
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
  ANY_ZONE_ID, matchesZone, listZones, getCameraZones, registerZoneListeners,
};
