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
  assert(streams.high === 'rtsp://nvr.example/live/high', 'expected high RTSPS URL to become RTSP');
  assert(streams.package === 'rtsp://nvr.example/live/package', 'expected package RTSPS URL to become RTSP');
  assert(streams.medium === 'rtsp://nvr.example/live/medium', 'expected existing RTSP URL to remain unchanged');
  assert(streams.low === null, 'expected non-string stream values to remain unchanged');
  assert(streams.metadata === 'unchanged', 'expected non-stream response fields to remain unchanged');
}

async function run() {
  const response = JSON.stringify({
    high: 'rtsps://nvr.example/live/high',
    package: 'RTSPS://nvr.example/live/package',
    medium: 'rtsp://nvr.example/live/medium',
    low: null,
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