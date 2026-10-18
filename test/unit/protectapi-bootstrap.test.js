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

  test('getCameras tolerates a camera without featureFlags', async () => {
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

  test('_findArmProfileIdByName skips a matching profile without id', () => {
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

describe('_isAuthError', () => {
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

  const NIGHT_BOOTSTRAP = { nvr: { armProfiles: [{ id: 'night-id', name: 'night' }] } };

  test('night uses v1 arm/enable with the profile id first (v2 not touched)', async () => {
    const api = createApi(NIGHT_BOOTSTRAP);
    api._setNvrModeV2 = jest.fn();
    api.webclient = { post: jest.fn(async () => '{}') };
    await expect(api.setNvrArmMode('night')).resolves.toBe('NVR night mode enabled successfully.');
    expect(api.webclient.post).toHaveBeenCalledWith('arm/enable', { armProfileId: 'night-id' });
    expect(api._setNvrModeV2).not.toHaveBeenCalled();
  });

  test('night falls back to v2 when v1 fails', async () => {
    const api = createApi(NIGHT_BOOTSTRAP);
    api.webclient = {
      post: jest.fn(async () => {
        throw new Error('status code: 500');
      }),
    };
    api._setNvrModeV2 = jest.fn(async () => ({ endpoint: '/x', message: 'night via v2' }));
    await expect(api.setNvrArmMode('night')).resolves.toBe('night via v2');
  });

  test('night without a bootstrap profile goes straight to v2', async () => {
    const api = create();
    api.webclient = { post: jest.fn() };
    api._setNvrModeV2 = jest.fn(async () => ({ endpoint: '/x', message: 'night via v2' }));
    await expect(api.setNvrArmMode('night')).resolves.toBe('night via v2');
    expect(api.webclient.post).not.toHaveBeenCalled();
  });

  test('night fails with both reasons when v1 and v2 fail', async () => {
    const api = create();
    api._setNvrModeV2 = jest.fn(async () => {
      throw new Error('v2 broke');
    });
    await expect(api.setNvrArmMode('night')).rejects.toThrow(/No night arm profile found.*v2 fallback failed: v2 broke/);
  });

  test('night does not fall back on v1 auth errors', async () => {
    const api = createApi(NIGHT_BOOTSTRAP);
    api.webclient = {
      post: jest.fn(async () => {
        throw new Error('status code: 401');
      }),
    };
    api._setNvrModeV2 = jest.fn();
    await expect(api.setNvrArmMode('night')).rejects.toThrow('401');
    expect(api._setNvrModeV2).not.toHaveBeenCalled();
  });
});

describe('setNvrAwayMode (v1 first, v2 fallback)', () => {
  const ARMED_BOOTSTRAP = { nvr: { armMode: { armProfileId: 'p1' } } };

  function create(bootstrap = ARMED_BOOTSTRAP) {
    const api = createApi(bootstrap);
    api.webclient = { post: jest.fn(async () => '{}') };
    api._setNvrAwayModeV2 = jest.fn(async () => ({ endpoint: '/e', message: 'via v2' }));
    return api;
  }

  test('arm uses v1 arm/enable with the bootstrap profile id', async () => {
    const api = create();
    await expect(api.setNvrAwayMode(true)).resolves.toBe('NVR armed successfully.');
    expect(api.webclient.post).toHaveBeenCalledWith('arm/enable', { armProfileId: 'p1' });
    expect(api._setNvrAwayModeV2).not.toHaveBeenCalled();
  });

  test('disarm uses v1 arm/disable', async () => {
    const api = create();
    await expect(api.setNvrAwayMode(false)).resolves.toBe('NVR disarmed successfully.');
    expect(api.webclient.post).toHaveBeenCalledWith('arm/disable', {});
    expect(api._setNvrAwayModeV2).not.toHaveBeenCalled();
  });

  test('arm without armProfileId in bootstrap falls back to v2', async () => {
    const api = create({ nvr: {} });
    await expect(api.setNvrAwayMode(true)).resolves.toBe('via v2');
    expect(api.webclient.post).not.toHaveBeenCalled();
  });

  test('v1 request failure falls back to v2', async () => {
    const api = create();
    api.webclient.post = jest.fn(async () => {
      throw new Error('status code: 404');
    });
    await expect(api.setNvrAwayMode(false)).resolves.toBe('via v2');
  });

  test.each([401, 403])('v1 auth error %s is rethrown without v2 fallback', async (code) => {
    const api = create();
    api.webclient.post = jest.fn(async () => {
      throw new Error(`status code: ${code}`);
    });
    await expect(api.setNvrAwayMode(true)).rejects.toThrow(`${code}`);
    expect(api._setNvrAwayModeV2).not.toHaveBeenCalled();
  });

  test('both failing reports both reasons and logs an error', async () => {
    const api = create();
    api.webclient.post = jest.fn(async () => {
      throw new Error('socket hang up');
    });
    api._setNvrAwayModeV2 = jest.fn(async () => {
      throw new Error('v2 down');
    });
    await expect(api.setNvrAwayMode(true)).rejects.toThrow(/socket hang up.*v2 fallback failed: v2 down/);
    expect(api.homey.app.error).toHaveBeenCalled();
  });
});

describe('_findV2AlarmProfileIdByName', () => {
  const UUID_A = '123e4567-e89b-12d3-a456-426614174000';
  const UUID_B = '123e4567-e89b-12d3-a456-426614174111';

  test('returns the UUID of the profile matching by name', () => {
    const api = createApi({ nvr: { armProfiles: [{ id: UUID_A, name: 'Night' }] } });
    expect(api._findV2AlarmProfileIdByName('night')).toBe(UUID_A);
  });

  // Regression (#7b): the first name match used to win even when its id was not a UUID.
  test('skips a matching profile without a UUID id and uses a later valid one', () => {
    const api = createApi({ nvr: { armProfiles: [{ id: 'legacy', name: 'night' }, { name: 'night' }, { id: UUID_B, mode: 'night' }] } });
    expect(api._findV2AlarmProfileIdByName('night')).toBe(UUID_B);
  });

  test('null when nothing matches', () => {
    const api = createApi({ nvr: { armProfiles: [{ id: UUID_A, name: 'away' }] } });
    expect(api._findV2AlarmProfileIdByName('night')).toBeNull();
    expect(createApi(null)._findV2AlarmProfileIdByName('night')).toBeNull();
  });
});
