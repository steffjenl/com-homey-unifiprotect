'use strict';

const ProtectAPI = require('../../library/protectapi');
const { getRtspStreamUrl } = require('../../library/rtsp-stream-url');

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
        calls.push({
          api: 'v1', cameraId: camera.id, packageCamera: false, quality,
        });
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

const camera = { id: 'camera-1', name: 'Front Door' };

describe('getRtspStreamUrl resolver', () => {
  test('prefers V1 and does not call V2 when V1 succeeds', async () => {
    const app = createApp({ v2Streams: { high: 'rtsp://nvr/high' }, v1StreamUrl: 'rtsp://nvr/v1' });
    expect(await getRtspStreamUrl(app, camera)).toBe('rtsp://nvr/v1');
    expect(app.calls).toHaveLength(1);
    expect(app.calls[0].api).toBe('v1');
  });

  test('falls back to medium when high is missing', async () => {
    const app = createApp({ v1Available: false, v2Streams: { high: null, medium: 'rtsp://nvr/medium', low: 'rtsp://nvr/low' } });
    expect(await getRtspStreamUrl(app, camera)).toBe('rtsp://nvr/medium');
  });

  test('falls back to V2 when V1 returns no stream', async () => {
    const app = createApp({ v2Streams: { high: 'rtsp://nvr/high' }, v1StreamUrl: '' });
    expect(await getRtspStreamUrl(app, camera)).toBe('rtsp://nvr/high');
    expect(app.calls.some((call) => call.api === 'v2')).toBe(true);
  });

  test.each([
    ['V1 package preferred', { v2Streams: { package: 'rtsp://nvr/package' }, v1PackageStreamUrl: 'rtsp://nvr/v1-package' }, 'rtsp://nvr/v1-package'],
    ['V1 package when V2 package missing', { v2Streams: { package: null }, v1PackageStreamUrl: 'rtsp://nvr/v1-package' }, 'rtsp://nvr/v1-package'],
    ['V2 package when V1 package missing', { v2Streams: { package: 'rtsp://nvr/package' }, v1PackageStreamUrl: '' }, 'rtsp://nvr/package'],
  ])('package camera: %s', async (_label, options, expected) => {
    expect(await getRtspStreamUrl(createApp(options), camera, { packageCamera: true })).toBe(expected);
  });
});

describe('getRtspStreamUrl quality', () => {
  test('V1 low stream', async () => {
    const app = createApp({ v1ByQuality: { auto: 'rtsp://nvr/auto', low: 'rtsp://nvr/low' } });
    expect(await getRtspStreamUrl(app, camera, { quality: 'low' })).toBe('rtsp://nvr/low');
  });

  test('V1 falls back to auto when quality missing', async () => {
    const app = createApp({ v1ByQuality: { auto: 'rtsp://nvr/auto' } });
    expect(await getRtspStreamUrl(app, camera, { quality: 'medium' })).toBe('rtsp://nvr/auto');
  });

  test('V2 requests only the requested quality', async () => {
    const app = createApp({ v1Available: false, v2Streams: { medium: 'rtsp://nvr/medium', high: 'rtsp://nvr/high' } });
    expect(await getRtspStreamUrl(app, camera, { quality: 'medium' })).toBe('rtsp://nvr/medium');
    expect(app.calls[0].qualities).toEqual(['medium']);
  });

  test('V2 falls back to available stream when quality missing', async () => {
    const app = createApp({ v1Available: false, v2Streams: { high: 'rtsp://nvr/high' } });
    expect(await getRtspStreamUrl(app, camera, { quality: 'low' })).toBe('rtsp://nvr/high');
  });

  test('quality auto behaves as default', async () => {
    const app = createApp({ v1ByQuality: { auto: 'rtsp://nvr/auto' } });
    expect(await getRtspStreamUrl(app, camera, { quality: 'auto' })).toBe('rtsp://nvr/auto');
  });
});

describe('ProtectAPI v1 stream URLs', () => {
  function createApi() {
    const api = new ProtectAPI();
    api.webclient = { getServerHost: () => 'nvr.example' };
    api._rtspPort = 7447;
    return api;
  }

  test('empty URL when channels are missing', async () => {
    const api = createApi();
    api.findCameraById = async () => ({});
    expect(await api.getStreamUrl({ id: 'camera-1' })).toBe('');
    expect(await api.getPackageStreamUrl({ id: 'camera-1' })).toBe('');
  });

  test('empty URL when channels are disabled', async () => {
    const api = createApi();
    api.findCameraById = async () => ({ channels: [{ name: 'High', isRtspEnabled: false, rtspAlias: 'disabled' }] });
    expect(await api.getStreamUrl({ id: 'camera-1' })).toBe('');
  });

  test('picks channel by quality, first channel for auto', async () => {
    const api = createApi();
    api.findCameraById = async () => ({
      channels: [
        { name: 'High', isRtspEnabled: true, rtspAlias: 'hi' },
        { name: 'Low', isRtspEnabled: true, rtspAlias: 'lo' },
      ],
    });
    expect(await api.getStreamUrl({ id: 'camera-1' }, false, 'low')).toBe('rtsp://nvr.example:7447/lo');
    expect(await api.getStreamUrl({ id: 'camera-1' }, false, 'medium')).toBe('');
    expect(await api.getStreamUrl({ id: 'camera-1' })).toBe('rtsp://nvr.example:7447/hi');
  });
});
