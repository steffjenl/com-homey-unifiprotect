'use strict';

const RtspUrlMixin = require('../../library/RtspUrlMixin');

function createDevice({
  codec, streams, codecSetting = 'auto', nvr,
}) {
  const warnings = [];
  const timers = [];
  let callCount = 0;
  const device = {
    rtspUrl: '',
    warnings,
    timers,
    log: () => {},
    error: () => {},
    getName: () => 'cam',
    getData: () => ({ id: 'abc' }),
    getSetting: (key) => (key === 'ufp:video_codec' ? codecSetting : 'high'),
    setWarning: async (value) => {
      warnings.push(value);
    },
    homey: {
      __: (key) => key,
      setTimeout: (fn, ms) => {
        timers.push({ fn, ms });
        return timers.length;
      },
      clearTimeout: () => {},
      app: {
        debug: () => {},
        isV1Available: () => false,
        isV2Available: () => true,
        api: { getBootstrap: () => ({ nvr, cameras: [{ id: 'abc', videoCodec: codec }] }) },
        apiV2: {
          getRtspsStream: async () => {
            callCount += 1;
            const stream = streams[Math.min(callCount - 1, streams.length - 1)];
            if (stream instanceof Error) throw stream;
            return stream;
          },
        },
      },
    },
  };
  return Object.assign(device, RtspUrlMixin);
}

const lastWarning = (device) => device.warnings[device.warnings.length - 1];

describe('RtspUrlMixin', () => {
  test('empty on first failure, warning cleared after successful retry', async () => {
    const device = createDevice({ codec: 'h264', streams: [new Error('not ready'), new Error('not ready'), { high: 'rtsps://x/high' }] });
    await device._refreshRtspUrl();
    expect(device.rtspUrl).toBe('');
    expect(device.warnings[0]).toBe('warnings.no_rtsp_url');
    expect(device.timers).toHaveLength(1); // retry scheduled

    await device.timers[0].fn();
    await new Promise((resolve) => {
      setImmediate(resolve);
    });
    expect(device.rtspUrl).toMatch(/^rtsp/);
    expect(lastWarning(device)).toBeNull();
  });

  test('H.265 camera with forced h264 demuxer warns', async () => {
    const device = createDevice({ codec: 'h265', codecSetting: 'h264', streams: [{ high: 'rtsps://x/high' }] });
    await device._refreshRtspUrl();
    expect(lastWarning(device)).toBe('warnings.h265_stream');
  });

  test('auto + h265 uses hevc demuxer without warning', async () => {
    const device = createDevice({ codec: 'h265', streams: [{ high: 'rtsps://x/high' }] });
    await device._refreshRtspUrl();
    expect(lastWarning(device)).toBeNull();
  });

  test.each([
    ['auto + h265', 'h265', 'auto', 'hevc'],
    ['auto + h264', 'h264', 'auto', 'h264'],
    ['auto + unknown', null, 'auto', 'h264'],
    ['override hevc', 'h264', 'hevc', 'hevc'],
    ['override h264', 'h265', 'h264', 'h264'],
  ])('demuxer selection: %s', (_label, codec, codecSetting, expected) => {
    expect(createDevice({ codec, codecSetting, streams: [] })._getDemuxer()).toBe(expected);
  });

  describe('Super Encoding warning', () => {
    const on = { isSuperEncodingEnabled: true, superEncodingCodec: 'h265', superEncodingCameraTargetCodecs: null };
    const streams = [{ high: 'rtsps://x/high' }];

    test('enabled + h264 camera + auto demuxer warns', async () => {
      const device = createDevice({ codec: 'h264', streams, nvr: on });
      await device._refreshRtspUrl();
      expect(lastWarning(device)).toBe('warnings.super_encoding');
    });

    test('enabled but hevc demuxer override: no warning', async () => {
      const device = createDevice({
        codec: 'h264', codecSetting: 'hevc', streams, nvr: on,
      });
      await device._refreshRtspUrl();
      expect(lastWarning(device)).toBeNull();
    });

    test.each([
      ['disabled', { ...on, isSuperEncodingEnabled: false }],
      ['no nvr data (V2 only)', undefined],
      ['h264 target codec', { ...on, superEncodingCodec: 'h264' }],
    ])('%s: no warning', async (_label, nvr) => {
      const device = createDevice({ codec: 'h264', streams, nvr });
      await device._refreshRtspUrl();
      expect(lastWarning(device)).toBeNull();
    });

    test('per-camera target codec overrides global codec', async () => {
      const device = createDevice({ codec: 'h264', streams, nvr: { ...on, superEncodingCameraTargetCodecs: { abc: 'h264' } } });
      await device._refreshRtspUrl();
      expect(lastWarning(device)).toBeNull();
    });

    test('missing RTSP URL keeps priority', async () => {
      const device = createDevice({ codec: 'h264', streams: [new Error('x')], nvr: on });
      await device._refreshRtspUrl();
      expect(device.warnings[0]).toBe('warnings.no_rtsp_url');
    });
  });
});
