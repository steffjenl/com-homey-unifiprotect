'use strict';

const ProtectAPI = require('../../library/protectapi');

function createApi(bootstrap = null) {
  const api = new ProtectAPI();
  api._bootstrap = bootstrap;
  api.homey = { app: { debug: () => {}, error: jest.fn() } };
  return api;
}

describe('_compactBootstrapPayload', () => {
  const api = createApi();

  test('drops event history and trims users to id + localUsername', () => {
    const result = api._compactBootstrapPayload({
      nvr: { id: 'n' },
      events: [{ id: 'e1' }, { id: 'e2' }],
      users: [{
        id: 'u1', localUsername: 'bob', email: 'b@x', cloudIdentity: { secret: 1 },
      }],
    });
    expect(result.events).toEqual([]);
    expect(result.users).toEqual([{ id: 'u1', localUsername: 'bob' }]);
    expect(result.nvr).toEqual({ id: 'n' });
  });

  test('does not mutate the input', () => {
    const payload = { events: [1], users: [{ id: 'u', email: 'x' }] };
    api._compactBootstrapPayload(payload);
    expect(payload.events).toHaveLength(1);
    expect(payload.users[0].email).toBe('x');
  });

  test.each([[null], [undefined], ['str'], [[1, 2]]])('passes %p through untouched', (input) => {
    expect(api._compactBootstrapPayload(input)).toBe(input);
  });
});

describe('getNvrName', () => {
  test.each([
    ['name', { name: 'NVR', host: 'h', id: 'i' }, 'NVR'],
    ['host when name missing', { host: 'h', id: 'i' }, 'h'],
    ['host when name null', { name: null, host: 'h' }, 'h'],
    ['id when only id', { id: 'i' }, 'i'],
    ['undefined when nothing', {}, undefined],
  ])('falls back: %s', (_label, nvr, expected) => {
    expect(createApi({ nvr }).getNvrName()).toBe(expected);
  });
});

describe('camera / doorbell listing', () => {
  const cameras = [
    { id: 'plain', featureFlags: { isDoorbell: false }, type: 'UVC G4 Pro' },
    { id: 'bell', featureFlags: { isDoorbell: true } },
    { id: 'chime-cam', featureFlags: { hasChime: true } },
    { id: 'hint-type', featureFlags: {}, type: 'UVC G4 Doorbell Pro' },
    { id: 'hint-market', featureFlags: {}, marketName: 'G6 Entry' },
  ];

  function apiWithCameras(list) {
    const api = createApi();
    api.webclient = { get: async () => JSON.stringify(list) };
    return api;
  }

  test('getCameras excludes doorbells', async () => {
    const result = await apiWithCameras(cameras.slice(0, 2)).getCameras();
    expect(result.map((c) => c.id)).toEqual(['plain']);
  });

  test('getDoorbells matches flag, chime and model hints', async () => {
    const result = await apiWithCameras(cameras).getDoorbells();
    expect(result.map((c) => c.id)).toEqual(['bell', 'chime-cam', 'hint-type', 'hint-market']);
  });

  // KNOWN ISSUE (test/KNOWN_ISSUES.md #5): getCameras dereferences featureFlags without a guard,
  // unlike getDoorbells (optional chaining). test.failing flips to failing once fixed.
  test.failing('getCameras tolerates a camera without featureFlags', async () => {
    const result = await apiWithCameras([{ id: 'odd' }]).getCameras();
    expect(result.map((c) => c.id)).toEqual(['odd']);
  });
});

describe('arm profile helpers', () => {
  test('_findArmProfileIdByName searches all profile groups, case-insensitively, over several keys', () => {
    const api = createApi({
      nvr: {
        armProfiles: [{ id: 'a', name: 'Away' }],
        armModeProfiles: [{ id: 'b', type: 'NIGHT' }],
        alarmSettings: { armProfiles: [{ id: 'c', description: 'Vacation' }] },
      },
    });
    expect(api._findArmProfileIdByName('away')).toBe('a');
    expect(api._findArmProfileIdByName('night')).toBe('b');
    expect(api._findArmProfileIdByName('vacation')).toBe('c');
    expect(api._findArmProfileIdByName('nope')).toBeNull();
  });

  test('_findArmProfileIdByName stringifies numeric ids and skips non-object entries', () => {
    const api = createApi({ nvr: { armProfiles: [null, 'x', { id: 12, mode: 'night' }] } });
    expect(api._findArmProfileIdByName('night')).toBe('12');
  });

  // KNOWN ISSUE (test/KNOWN_ISSUES.md #7): find() returns the first name match even if it has no
  // id, so a later matching profile that does have an id is never reached.
  test.failing('_findArmProfileIdByName skips a matching profile without id', () => {
    const api = createApi({ nvr: { armProfiles: [{ name: 'night' }, { id: 'good', mode: 'night' }] } });
    expect(api._findArmProfileIdByName('night')).toBe('good');
  });

  test.each([
    ['no bootstrap', null],
    ['no nvr', {}],
    ['profiles not arrays', { nvr: { armProfiles: 'x' } }],
  ])('_findArmProfileIdByName: %s', (_label, bootstrap) => {
    expect(createApi(bootstrap)._findArmProfileIdByName('night')).toBeNull();
  });

  test.each([
    [{ id: 'a' }, 'a'],
    [{ profileId: 'b' }, 'b'],
    [{ uuid: 'c' }, 'c'],
    [{ alarmProfileId: 'd' }, 'd'],
    [{ id: '', profileId: 'e' }, 'e'],
    [{ id: 5 }, '5'],
    [{}, null],
    [null, null],
    ['str', null],
  ])('_extractProfileId(%p) -> %p', (profile, expected) => {
    expect(createApi()._extractProfileId(profile)).toBe(expected);
  });

  test.each([
    ['123e4567-e89b-12d3-a456-426614174000', true],
    ['123E4567-E89B-12D3-A456-426614174000', true],
    ['not-a-uuid', false],
    ['', false],
    [null, false],
  ])('_isUuid(%p) -> %p', (value, expected) => {
    expect(createApi()._isUuid(value)).toBe(expected);
  });
});

describe('_isAuthError / _canFallbackToV1FromV2Error', () => {
  const api = createApi();

  test.each([
    [new Error('failed, status code: 401'), true],
    [new Error('status code: 403'), true],
    [new Error('no permission'), true],
    ['status code: 401', true],
    [new Error('status code: 500'), false],
    [null, false],
  ])('_isAuthError(%p) -> %p', (error, expected) => {
    expect(api._isAuthError(error)).toBe(expected);
  });

  test.each([
    ['/api/v2/alarms/profiles status code: 404', true],
    ['/api/v2/alarms/profiles status code: 405', true],
    ['/api/v2/alarms/profiles status code: 500', true],
    ['/api/v2/alarms/profiles No alarm profiles returned', true],
    ['/api/v2/alarms/profiles Unable to resolve v2 alarm profile id', true],
    ['/api/v2/alarms/profiles status code: 401', false], // auth: never retry
    ['status code: 404', false], // different endpoint
    ['/api/v2/alarms/profiles timeout', false],
  ])('%s -> %p', (message, expected) => {
    expect(api._canFallbackToV1FromV2Error(new Error(message))).toBe(expected);
  });

  test('null error cannot fall back', () => {
    expect(api._canFallbackToV1FromV2Error(null)).toBe(false);
  });
});

describe('getNvrArmState', () => {
  test('prefers bootstrap nvr.armMode', async () => {
    const armMode = { status: 'armed', armProfileId: 'p' };
    await expect(createApi({ nvr: { armMode, isAway: false } }).getNvrArmState()).resolves.toBe(armMode);
  });

  test.each([
    [true, 'armed'],
    [false, 'disarmed'],
  ])('falls back to legacy isAway=%s', async (isAway, status) => {
    await expect(createApi({ nvr: { isAway } }).getNvrArmState()).resolves.toEqual({ status, isAway });
  });

  test.each([
    ['no bootstrap', null],
    ['no nvr', {}],
    ['nvr without state', { nvr: {} }],
  ])('rejects when %s', async (_label, bootstrap) => {
    await expect(createApi(bootstrap).getNvrArmState()).rejects.toThrow('NVR arm state not available');
  });
});

describe('setNvrArmMode', () => {
  function create() {
    const api = createApi({ nvr: {} });
    api.setNvrAwayMode = jest.fn(async () => 'ok');
    return api;
  }

  test.each(['disabled', 'DISARM', 'disarmed'])('%s disarms', async (mode) => {
    const api = create();
    await api.setNvrArmMode(mode);
    expect(api.setNvrAwayMode).toHaveBeenCalledWith(false);
  });

  test.each(['away', 'arm', 'Armed'])('%s arms', async (mode) => {
    const api = create();
    await api.setNvrArmMode(mode);
    expect(api.setNvrAwayMode).toHaveBeenCalledWith(true);
  });

  test.each(['bogus', '', null, undefined])('unsupported mode %p rejects', async (mode) => {
    await expect(create().setNvrArmMode(mode)).rejects.toThrow('Unsupported arm mode');
  });

  test('night without a profile in bootstrap and v2 failure rejects', async () => {
    const api = create();
    api._setNvrModeV2 = jest.fn(async () => {
      throw new Error('v2 broke');
    });
    await expect(api.setNvrArmMode('night')).rejects.toThrow('No night arm profile found');
  });

  test('night uses the v2 endpoint when it works', async () => {
    const api = create();
    api._setNvrModeV2 = jest.fn(async () => ({ endpoint: '/x', message: 'night via v2' }));
    await expect(api.setNvrArmMode('night')).resolves.toBe('night via v2');
  });

  test('night falls back to v1 arm/enable with the profile id', async () => {
    const api = createApi({ nvr: { armProfiles: [{ id: 'night-id', name: 'night' }] } });
    api._setNvrModeV2 = jest.fn(async () => {
      throw new Error('v2 broke');
    });
    api.webclient = { post: jest.fn(async () => '{}') };
    await expect(api.setNvrArmMode('night')).resolves.toBe('NVR night mode enabled successfully.');
    expect(api.webclient.post).toHaveBeenCalledWith('arm/enable', { armProfileId: 'night-id' });
  });

  test('night does not fall back on auth errors', async () => {
    const api = createApi({ nvr: { armProfiles: [{ id: 'night-id', name: 'night' }] } });
    api._setNvrModeV2 = jest.fn(async () => {
      throw new Error('status code: 401');
    });
    api.webclient = { post: jest.fn() };
    await expect(api.setNvrArmMode('night')).rejects.toThrow('401');
    expect(api.webclient.post).not.toHaveBeenCalled();
  });
});

describe('setNvrAwayMode', () => {
  test('uses v2 result message', async () => {
    const api = createApi();
    api._setNvrAwayModeV2 = jest.fn(async () => ({ endpoint: '/e', message: 'armed v2' }));
    api._setNvrAwayModeV1 = jest.fn();
    await expect(api.setNvrAwayMode(true)).resolves.toBe('armed v2');
    expect(api._setNvrAwayModeV1).not.toHaveBeenCalled();
  });

  test('falls back to v1 when v2 profile discovery is unavailable', async () => {
    const api = createApi();
    api._setNvrAwayModeV2 = jest.fn(async () => {
      throw new Error('/api/v2/alarms/profiles status code: 404');
    });
    api._setNvrAwayModeV1 = jest.fn(async () => 'armed v1');
    await expect(api.setNvrAwayMode(true)).resolves.toBe('armed v1');
  });

  test('auth errors are rethrown without v1 fallback', async () => {
    const api = createApi();
    api._setNvrAwayModeV2 = jest.fn(async () => {
      throw new Error('status code: 403');
    });
    api._setNvrAwayModeV1 = jest.fn();
    await expect(api.setNvrAwayMode(false)).rejects.toThrow('403');
    expect(api._setNvrAwayModeV1).not.toHaveBeenCalled();
  });

  test('other v2 errors are logged and rethrown without fallback', async () => {
    const api = createApi();
    api._setNvrAwayModeV2 = jest.fn(async () => {
      throw new Error('socket hang up');
    });
    api._setNvrAwayModeV1 = jest.fn();
    await expect(api.setNvrAwayMode(true)).rejects.toThrow('socket hang up');
    expect(api.homey.app.error).toHaveBeenCalled();
    expect(api._setNvrAwayModeV1).not.toHaveBeenCalled();
  });
});
