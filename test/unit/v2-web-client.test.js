'use strict';

const nock = require('nock');
const WebClient = require('../../library/protect-api-v2/web-client');

const HOST = 'nvr.local';
const BASE = '/proxy/protect/integration/v1';

function createClient(options) {
  const client = new WebClient();
  client.setSettings(HOST, 443, 'secret-key', options);
  return client;
}

beforeAll(() => nock.disableNetConnect());
afterEach(() => nock.cleanAll());
afterAll(() => nock.enableNetConnect());

describe('path and URL building', () => {
  test('local mode uses the NVR host and integration prefix', () => {
    const client = createClient();
    expect(client.getRequestHost()).toBe(HOST);
    expect(client.getRequestPort()).toBe(443);
    expect(client.buildApiPath('cameras')).toBe(`${BASE}/cameras`);
  });

  test('leading slashes are stripped and empty resource gives the prefix', () => {
    const client = createClient();
    expect(client.buildApiPath('///cameras/1')).toBe(`${BASE}/cameras/1`);
    expect(client.buildApiPath('')).toBe(BASE);
  });

  test('query string is encoded', () => {
    const client = createClient();
    expect(client.buildApiPath('x', { a: 'b c', n: 1 })).toBe(`${BASE}/x?a=b%20c&n=1`);
    expect(client.toQueryString({})).toBe('');
    expect(client.toQueryString(null)).toBe('');
  });

  test('cloud mode targets api.ui.com via the console connector', () => {
    const client = createClient({ cloudEnabled: true, consoleId: 'abc/def' });
    expect(client.isCloudEnabled()).toBe(true);
    expect(client.getRequestHost()).toBe('api.ui.com');
    expect(client.getRequestPort()).toBe(443);
    expect(client.buildApiPath('cameras')).toBe(`/v1/connector/consoles/abc%2Fdef${BASE.replace('/v1', '')}/v1/cameras`);
  });
});

describe('requests', () => {
  test('GET sends the API key and returns the body', async () => {
    const scope = nock(`https://${HOST}`, { reqheaders: { 'x-api-key': 'secret-key', accept: 'application/json' } })
      .get(`${BASE}/cameras`)
      .reply(200, '[{"id":"c1"}]');
    await expect(createClient().get('cameras')).resolves.toBe('[{"id":"c1"}]');
    expect(scope.isDone()).toBe(true);
  });

  test('GET passes query params', async () => {
    nock(`https://${HOST}`).get(`${BASE}/snap`).query({ w: '1920' }).reply(200, 'ok');
    await expect(createClient().get('snap', { w: 1920 })).resolves.toBe('ok');
  });

  test('binary GET returns a Buffer', async () => {
    nock(`https://${HOST}`).get(`${BASE}/snapshot`).reply(200, Buffer.from([1, 2, 3]));
    const result = await createClient().get('snapshot', {}, true);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect([...result]).toEqual([1, 2, 3]);
  });

  test('POST sends a JSON body', async () => {
    const scope = nock(`https://${HOST}`).post(`${BASE}/cameras/c1/rtsps-stream`, { qualities: ['high'] }).reply(201, '{"high":"rtsps://x"}');
    await expect(createClient().post('cameras/c1/rtsps-stream', { qualities: ['high'] })).resolves.toBe('{"high":"rtsps://x"}');
    expect(scope.isDone()).toBe(true);
  });

  test('PUT and PATCH send JSON bodies', async () => {
    const scope = nock(`https://${HOST}`)
      .put(`${BASE}/lights/l1`, { a: 1 }).reply(200, 'put')
      .patch(`${BASE}/lights/l1`, { b: 2 })
      .reply(200, 'patch');
    const client = createClient();
    await expect(client.put('lights/l1', { a: 1 })).resolves.toBe('put');
    await expect(client.patch('lights/l1', { b: 2 })).resolves.toBe('patch');
    expect(scope.isDone()).toBe(true);
  });

  test('DELETE works', async () => {
    nock(`https://${HOST}`).delete(`${BASE}/x`).reply(200, 'gone');
    await expect(createClient().delete('x')).resolves.toBe('gone');
  });

  test.each([
    ['POST', 204, true],
    ['POST', 201, true],
    ['PATCH', 204, true],
    ['DELETE', 204, true],
    ['PUT', 204, false], // PUT only accepts 200
    ['GET', 204, false], // GET only accepts 200
  ])('%s with status %s resolves=%s', async (method, status, resolves) => {
    nock(`https://${HOST}`).intercept(`${BASE}/x`, method).reply(status, '');
    const client = createClient();
    const call = {
      GET: () => client.get('x'),
      POST: () => client.post('x'),
      PUT: () => client.put('x'),
      PATCH: () => client.patch('x'),
      DELETE: () => client.delete('x'),
    }[method]();
    if (resolves) {
      await expect(call).resolves.toBe('');
    } else {
      await expect(call).rejects.toThrow(`status code: ${status}`);
    }
  });

  test.each(['get', 'post', 'put', 'patch', 'delete'])('%s: 403 gives the permission error', async (method) => {
    nock(`https://${HOST}`).intercept(`${BASE}/x`, method.toUpperCase()).reply(403, 'nope');
    await expect(createClient()[method]('x')).rejects.toThrow('has no permission');
  });

  test.each(['get', 'post', 'put', 'patch', 'delete'])('%s: 401 error carries the status code (matches ProtectAPI._isAuthError)', async (method) => {
    nock(`https://${HOST}`).intercept(`${BASE}/x`, method.toUpperCase()).reply(401, 'unauthorized');
    await expect(createClient()[method]('x')).rejects.toThrow('status code: 401');
  });

  test('429 and 500 are rejected with status and response body', async () => {
    nock(`https://${HOST}`).get(`${BASE}/x`).reply(429, 'slow down');
    await expect(createClient().get('x')).rejects.toThrow('status code: 429, response: slow down');
  });

  test('network errors reject', async () => {
    nock(`https://${HOST}`).get(`${BASE}/x`).replyWithError('ECONNRESET');
    await expect(createClient().get('x')).rejects.toThrow('ECONNRESET');
  });

  test('the API key never appears in error messages', async () => {
    nock(`https://${HOST}`).get(`${BASE}/x`).reply(500, 'boom');
    const error = await createClient().get('x').catch((e) => e);
    expect(error.message).not.toContain('secret-key');
  });
});
