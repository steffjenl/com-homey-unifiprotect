'use strict';

const Module = require('module');

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'homey') {
    return { SimpleClass: class SimpleClass {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const RtspUrlMixin = require('../library/RtspUrlMixin');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function createDevice({ codec, streams, codecSetting = 'auto' }) {
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
        api: { getBootstrap: () => ({ cameras: [{ id: 'abc', videoCodec: codec }] }) },
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

(async () => {
  // Empty first, success on retry -> warning cleared
  let device = createDevice({ codec: 'h264', streams: [new Error('not ready'), new Error('not ready'), { high: 'rtsps://x/high' }] });
  await device._refreshRtspUrl();
  assert(device.rtspUrl === '', 'rtspUrl should be empty on first failure');
  assert(device.warnings[0] === 'warnings.no_rtsp_url', 'no_rtsp_url warning expected');
  assert(device.timers.length === 1, 'retry should be scheduled');
  await device.timers[0].fn();
  await new Promise((resolve) => setImmediate(resolve));
  assert(device.rtspUrl.startsWith('rtsps://') || device.rtspUrl.startsWith('rtsp'), `rtspUrl expected after retry, got "${device.rtspUrl}"`);
  assert(device.warnings[device.warnings.length - 1] === null, 'warning should be cleared after retry');

  // H.265 camera, forced h264 demuxer -> warning
  device = createDevice({ codec: 'h265', codecSetting: 'h264', streams: [{ high: 'rtsps://x/high' }] });
  await device._refreshRtspUrl();
  assert(device.warnings[device.warnings.length - 1] === 'warnings.h265_stream', 'h265 warning expected');

  // Demuxer selection
  assert(createDevice({ codec: 'h265', streams: [] })._getDemuxer() === 'hevc', 'auto + h265 should use hevc');
  assert(createDevice({ codec: 'h264', streams: [] })._getDemuxer() === 'h264', 'auto + h264 should use h264');
  assert(createDevice({ codec: null, streams: [] })._getDemuxer() === 'h264', 'auto + unknown should use h264');
  assert(createDevice({ codec: 'h264', codecSetting: 'hevc', streams: [] })._getDemuxer() === 'hevc', 'override hevc');
  assert(createDevice({ codec: 'h265', codecSetting: 'h264', streams: [] })._getDemuxer() === 'h264', 'override h264');

  // Auto + h265 -> hevc demuxer, no warning
  device = createDevice({ codec: 'h265', streams: [{ high: 'rtsps://x/high' }] });
  await device._refreshRtspUrl();
  assert(device.warnings[device.warnings.length - 1] === null, 'no warning when hevc demuxer is used');

  console.log('rtsp-url-mixin smoke passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
