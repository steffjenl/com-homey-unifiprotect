'use strict';

const NORMAL_STREAM_QUALITIES = ['high', 'medium', 'low'];
const PACKAGE_STREAM_QUALITIES = ['package'];

function _debug(app, message) {
  if (app && typeof app.debug === 'function') {
    app.debug(message);
  }
}

function _getCameraName(camera) {
  return camera && camera.name ? camera.name : 'unknown camera';
}

function _pickStreamUrl(streams, qualities) {
  if (!streams) {
    return '';
  }

  for (const quality of qualities) {
    if (streams[quality]) {
      return streams[quality];
    }
  }

  return '';
}

async function _getV2StreamUrl(app, camera, qualities) {
  if (!app || !app.isV2Available || !app.isV2Available() || !app.apiV2) {
    return '';
  }

  try {
    const streams = await app.apiV2.getRtspsStream(camera.id, qualities);
    const streamUrl = _pickStreamUrl(streams, qualities);

    if (!streamUrl) {
      _debug(app, `[rtsp-stream-url] V2 returned no ${qualities.join('/')} stream for ${_getCameraName(camera)}`);
    }

    return streamUrl;
  } catch (error) {
    _debug(app, `[rtsp-stream-url] V2 stream lookup failed for ${_getCameraName(camera)} (${qualities.join('/')}): ${error}`);
    return '';
  }
}

async function _getV1StreamUrl(app, camera, packageCamera) {
  if (!app || !app.isV1Available || !app.isV1Available() || !app.api) {
    return '';
  }

  try {
    if (packageCamera) {
      return await app.api.getPackageStreamUrl(camera) || '';
    }

    return await app.api.getStreamUrl(camera) || '';
  } catch (error) {
    _debug(app, `[rtsp-stream-url] V1 stream lookup failed for ${_getCameraName(camera)}: ${error}`);
    return '';
  }
}

async function getRtspStreamUrl(app, camera, options = {}) {
  if (!camera || !camera.id) {
    return '';
  }

  const packageCamera = options.packageCamera === true;
  const qualities = packageCamera ? PACKAGE_STREAM_QUALITIES : NORMAL_STREAM_QUALITIES;
  const v1StreamUrl = await _getV1StreamUrl(app, camera, packageCamera);

  if (v1StreamUrl) {
    return v1StreamUrl;
  }

  const v2StreamUrl = await _getV2StreamUrl(app, camera, qualities);

  if (v2StreamUrl) {
    return v2StreamUrl;
  }

  return '';
}

module.exports = {
  NORMAL_STREAM_QUALITIES,
  PACKAGE_STREAM_QUALITIES,
  getRtspStreamUrl,
};