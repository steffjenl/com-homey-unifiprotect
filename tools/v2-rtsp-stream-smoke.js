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

const ProtectAPI = require('../library/protect-api-v2/protect-api');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertNormalizedStreams(streams) {
  assert(streams.high === 'rtsp://192.168.1.1:7447/live/high', 'expected high RTSPS URL to become RTSP on port 7447');
  assert(streams.package === 'rtsp://192.168.1.1:7447/live/package', 'expected package RTSPS URL to become RTSP on port 7447');
  assert(streams.medium === 'rtsp://192.168.1.1:7447/live/medium', 'expected existing RTSP port 7441 URL to move to port 7447');
  assert(streams.low === 'rtsp://nvr.example/live/low', 'expected existing RTSP URL without secure marker to remain unchanged');
  assert(streams.metadata === 'unchanged', 'expected non-stream response fields to remain unchanged');
}

async function run() {
  const response = JSON.stringify({
    high: 'rtsps://192.168.1.1:7441/live/high?enableSrtp',
    package: 'RTSPS://192.168.1.1:7441/live/package?enableSrtp',
    medium: 'rtsp://192.168.1.1:7441/live/medium?enableSrtp',
    low: 'rtsp://nvr.example/live/low',
    metadata: 'unchanged',
  });
  const api = new ProtectAPI();
  api.webclient = {
    post: async () => response,
    get: async () => response,
  };

  assertNormalizedStreams(await api.getRtspsStream('camera-1', ['high', 'package']));
  assertNormalizedStreams(await api.getExistingRtspsStream('camera-1'));

  // eslint-disable-next-line no-console
  console.log('V2 RTSP stream smoke test passed');
}

run().catch(error => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});