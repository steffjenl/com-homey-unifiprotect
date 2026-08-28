'use strict';

/**
 * Shared RTSP(S) availability detection for cameras and doorbells.
 *
 * A camera only delivers a livestream in Homey when its RTSP (v1) or
 * RTSPS (v2) stream is shared in UniFi Protect. This module reports that
 * state without changing it: on the v2 Integration API only the read-only
 * GET cameras/{id}/rtsps-stream endpoint is used, never the POST variant
 * that would enable sharing on the user's behalf.
 */

const GUIDE_URL = 'https://github.com/steffjenl/com-homey-unifiprotect/blob/develop/wiki/rtsp-setup.md';

const PACKAGE_CHANNEL_NAME = 'Package Camera';

/**
 * Read the RTSP state from a v1 camera object (or fetch it when the object
 * does not carry its channels).
 *
 * @returns {Promise<{enabled: boolean|null, packageEnabled: boolean|null}>}
 */
async function _getV1Status(app, camera) {
  let { channels } = camera;

  if (!Array.isArray(channels)) {
    const cameraInfo = await app.api.findCameraById(camera.id);
    channels = cameraInfo ? cameraInfo.channels : null;
  }

  if (!Array.isArray(channels)) {
    return { enabled: null, packageEnabled: null };
  }

  return {
    enabled: channels.some((channel) => channel.isRtspEnabled && channel.name !== PACKAGE_CHANNEL_NAME),
    packageEnabled: channels.some((channel) => channel.isRtspEnabled && channel.name === PACKAGE_CHANNEL_NAME),
  };
}

/**
 * Read the RTSPS state from the v2 Integration API. Read-only.
 *
 * @returns {Promise<{enabled: boolean|null, packageEnabled: boolean|null}>}
 */
async function _getV2Status(app, camera) {
  const streams = await app.apiV2.getExistingRtspsStream(camera.id);

  if (!streams) {
    return { enabled: null, packageEnabled: null };
  }

  return {
    enabled: Boolean(streams.high || streams.medium || streams.low),
    packageEnabled: Boolean(streams.package),
  };
}

/**
 * Determine whether a single camera has an RTSP(S) stream shared.
 *
 * `enabled` is `null` when the state could not be determined (no API
 * available, request failed); callers should not warn in that case.
 *
 * @param {object} app the Homey app instance
 * @param {object} camera a camera object as returned by the Protect API
 * @returns {Promise<{id: string, name: string, enabled: boolean|null, packageEnabled: boolean|null}>}
 */
async function getRtspStatus(app, camera) {
  const base = { id: String(camera.id), name: camera.name };

  try {
    if (app.isV1Available()) {
      return { ...base, ...(await _getV1Status(app, camera)) };
    }
    if (app.isV2Available()) {
      return { ...base, ...(await _getV2Status(app, camera)) };
    }
    app.debug(`[rtsp-status] No API available to check RTSP for ${camera.name}`);
  } catch (error) {
    app.debug(`[rtsp-status] Could not determine RTSP state for ${camera.name}: ${error}`);
  }

  return { ...base, enabled: null, packageEnabled: null };
}

/**
 * Determine the RTSP(S) state for a list of cameras in parallel. Never
 * rejects: cameras whose state could not be determined get `enabled: null`.
 *
 * @param {object} app the Homey app instance
 * @param {object[]} cameras camera objects as returned by the Protect API
 * @returns {Promise<Array<{id: string, name: string, enabled: boolean|null, packageEnabled: boolean|null}>>}
 */
async function getRtspStatusForAll(app, cameras) {
  const results = await Promise.allSettled(
    Object.values(cameras || {}).map((camera) => getRtspStatus(app, camera)),
  );

  return results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
}

/**
 * The cameras from `cameras` that have no RTSP(S) stream shared. Cameras
 * with an unknown state are left out.
 *
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
async function getCamerasWithoutRtsp(app, cameras) {
  const statuses = await getRtspStatusForAll(app, cameras);

  return statuses
    .filter((status) => status.enabled === false)
    .map((status) => ({ id: status.id, name: status.name }));
}

module.exports = {
  GUIDE_URL,
  getRtspStatus,
  getRtspStatusForAll,
  getCamerasWithoutRtsp,
};
