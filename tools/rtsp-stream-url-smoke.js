'use strict';

const Module = require('module');

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'homey') {
    return {
      SimpleClass: class SimpleClass {},
    };
  }

  return originalLoad.call(this, request, parent, isMain);
};

const ProtectAPI = require('../library/protectapi');
const { getRtspStreamUrl } = require('../library/rtsp-stream-url');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createApp(options) {
  const calls = [];

  return {
    calls,
    debug: () => {},
    isV2Available: () => options.v2Available !== false,
    isV1Available: () => options.v1Available !== false,
    apiV2: {
      getRtspsStream: async (cameraId, qualities) => {
        calls.push({ api: 'v2', cameraId, qualities });
        if (options.v2Error) {
          throw options.v2Error;
        }
        return options.v2Streams || null;
      },
    },
    api: {
      getStreamUrl: async (camera, packageCamera, quality) => {
        calls.push({ api: 'v1', cameraId: camera.id, packageCamera: false, quality });
        if (options.v1ByQuality) {
          return options.v1ByQuality[quality || 'auto'] || '';
        }
        return options.v1StreamUrl || '';
      },
      getPackageStreamUrl: async (camera) => {
        calls.push({ api: 'v1', cameraId: camera.id, packageCamera: true });
        return options.v1PackageStreamUrl || '';
      },
    },
  };
}

async function assertResolverBehavior() {
  const camera = { id: 'camera-1', name: 'Front Door' };
  let app = createApp({ v2Streams: { high: 'rtsp://nvr/high' }, v1StreamUrl: 'rtsp://nvr/v1' });
  assert(await getRtspStreamUrl(app, camera) === 'rtsp://nvr/v1', 'expected V1 stream to be preferred when available');
  assert(app.calls.length === 1 && app.calls[0].api === 'v1', 'expected V2 not to be called when V1 succeeds');

  app = createApp({ v1Available: false, v2Streams: { high: null, medium: 'rtsp://nvr/medium', low: 'rtsp://nvr/low' } });
  assert(await getRtspStreamUrl(app, camera) === 'rtsp://nvr/medium', 'expected medium fallback when high is missing');

  app = createApp({ v2Streams: { high: 'rtsp://nvr/high' }, v1StreamUrl: '' });
  assert(await getRtspStreamUrl(app, camera) === 'rtsp://nvr/high', 'expected V2 fallback when V1 returns no stream');
  assert(app.calls.some((call) => call.api === 'v2'), 'expected V2 to be called after empty V1 result');

  app = createApp({ v2Streams: { package: 'rtsp://nvr/package' }, v1PackageStreamUrl: 'rtsp://nvr/v1-package' });
  assert(await getRtspStreamUrl(app, camera, { packageCamera: true }) === 'rtsp://nvr/v1-package', 'expected V1 package stream to be preferred when available');

  app = createApp({ v2Streams: { package: null }, v1PackageStreamUrl: 'rtsp://nvr/v1-package' });
  assert(await getRtspStreamUrl(app, camera, { packageCamera: true }) === 'rtsp://nvr/v1-package', 'expected V1 package fallback when V2 package is missing');

  app = createApp({ v2Streams: { package: 'rtsp://nvr/package' }, v1PackageStreamUrl: '' });
  assert(await getRtspStreamUrl(app, camera, { packageCamera: true }) === 'rtsp://nvr/package', 'expected V2 package fallback when V1 package is missing');
}

async function assertQualityBehavior() {
  const camera = { id: 'camera-1', name: 'Front Door' };
  let app = createApp({ v1ByQuality: { auto: 'rtsp://nvr/auto', low: 'rtsp://nvr/low' } });
  assert(await getRtspStreamUrl(app, camera, { quality: 'low' }) === 'rtsp://nvr/low', 'expected V1 low stream');

  app = createApp({ v1ByQuality: { auto: 'rtsp://nvr/auto' } });
  assert(await getRtspStreamUrl(app, camera, { quality: 'medium' }) === 'rtsp://nvr/auto', 'expected auto fallback when V1 quality missing');

  app = createApp({ v1Available: false, v2Streams: { medium: 'rtsp://nvr/medium', high: 'rtsp://nvr/high' } });
  assert(await getRtspStreamUrl(app, camera, { quality: 'medium' }) === 'rtsp://nvr/medium', 'expected V2 medium stream');
  assert(app.calls[0].qualities.length === 1 && app.calls[0].qualities[0] === 'medium', 'expected V2 to request only medium');

  app = createApp({ v1Available: false, v2Streams: { high: 'rtsp://nvr/high' } });
  assert(await getRtspStreamUrl(app, camera, { quality: 'low' }) === 'rtsp://nvr/high', 'expected V2 auto fallback when quality missing');

  app = createApp({ v1ByQuality: { auto: 'rtsp://nvr/auto' } });
  assert(await getRtspStreamUrl(app, camera, { quality: 'auto' }) === 'rtsp://nvr/auto', 'expected auto to behave as before');
}

async function assertV1MissingChannelsBehavior() {
  const api = new ProtectAPI();
  api.webclient = { getServerHost: () => 'nvr.example' };
  api._rtspPort = 7447;

  api.findCameraById = async () => ({});
  assert(await api.getStreamUrl({ id: 'camera-1' }) === '', 'expected empty URL when V1 channels are missing');
  assert(await api.getPackageStreamUrl({ id: 'camera-1' }) === '', 'expected empty package URL when V1 channels are missing');

  api.findCameraById = async () => ({ channels: [{ name: 'High', isRtspEnabled: false, rtspAlias: 'disabled' }] });
  assert(await api.getStreamUrl({ id: 'camera-1' }) === '', 'expected empty URL when V1 channels are disabled');

  api.findCameraById = async () => ({
    channels: [
      { name: 'High', isRtspEnabled: true, rtspAlias: 'hi' },
      { name: 'Low', isRtspEnabled: true, rtspAlias: 'lo' },
    ],
  });
  assert(await api.getStreamUrl({ id: 'camera-1' }, false, 'low') === 'rtsp://nvr.example:7447/lo', 'expected low channel');
  assert(await api.getStreamUrl({ id: 'camera-1' }, false, 'medium') === '', 'expected empty URL for missing medium channel');
  assert(await api.getStreamUrl({ id: 'camera-1' }) === 'rtsp://nvr.example:7447/hi', 'expected first channel in auto');
}

async function run() {
  await assertResolverBehavior();
  await assertQualityBehavior();
  await assertV1MissingChannelsBehavior();

  // eslint-disable-next-line no-console
  console.log('RTSP stream URL smoke test passed');
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
