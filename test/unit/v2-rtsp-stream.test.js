'use strict';

const ProtectAPI = require('../../library/protect-api-v2/protect-api');

const response = JSON.stringify({
  high: 'rtsps://192.168.1.1:7441/live/high?enableSrtp',
  package: 'RTSPS://192.168.1.1:7441/live/package?enableSrtp',
  medium: 'rtsp://192.168.1.1:7441/live/medium?enableSrtp',
  low: 'rtsp://nvr.example/live/low',
  metadata: 'unchanged',
});

function expectNormalized(streams) {
  expect(streams.high).toBe('rtsp://192.168.1.1:7447/live/high');
  expect(streams.package).toBe('rtsp://192.168.1.1:7447/live/package');
  expect(streams.medium).toBe('rtsp://192.168.1.1:7447/live/medium'); // port 7441 -> 7447
  expect(streams.low).toBe('rtsp://nvr.example/live/low'); // no secure marker: unchanged
  expect(streams.metadata).toBe('unchanged');
}

describe('ProtectAPI v2 RTSPS normalization', () => {
  const api = new ProtectAPI();
  api.webclient = { post: async () => response, get: async () => response };

  test('getRtspsStream', async () => {
    expectNormalized(await api.getRtspsStream('camera-1', ['high', 'package']));
  });

  test('getExistingRtspsStream', async () => {
    expectNormalized(await api.getExistingRtspsStream('camera-1'));
  });
});
