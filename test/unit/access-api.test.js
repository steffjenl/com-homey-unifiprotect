'use strict';

const AccessAPI = require('../../library/access-api-v2/access-api');

describe('AccessAPI device lookup', () => {
  test('finds intercoms, unique readers and hubs across device groups', async () => {
    const api = new AccessAPI();
    api.webclient = {
      get: async () => JSON.stringify({
        data: [
          [
            { unique_id: 'hub-1', capabilities: ['is_hub'] },
            { unique_id: 'reader-1', capabilities: ['is_reader'] },
          ],
          [
            {
              unique_id: 'intercom-1', device_type: 'UA-G3-Intercom', display_model: 'UA G3 Intercom', capabilities: ['is_reader'],
            },
            { unique_id: 'nocaps-1' },
          ],
          [
            { unique_id: 'reader-1', capabilities: ['is_reader'] },
          ],
        ],
      }),
    };

    const intercoms = await api.getIntercoms();
    expect(intercoms).toHaveLength(1);
    expect(intercoms[0].unique_id).toBe('intercom-1'); // later device group must be found

    expect(await api.getReaders()).toHaveLength(2); // reader-1 deduplicated, intercom is a reader
    expect(await api.getHubs()).toHaveLength(1);
  });
});

describe('AccessAPI.setDoorUnLock', () => {
  test('targets the door id and passes entry_method only when given', async () => {
    const api = new AccessAPI();
    const calls = [];
    api.webclient = {
      put: async (resource, payload, query) => {
        calls.push({ resource, payload, query });
        return JSON.stringify({ code: 'SUCCESS' });
      },
    };

    await api.setDoorUnLock('door-1');
    await api.setDoorUnLock('door-1', 'in');
    await api.setDoorUnLock('door-1', 'out');

    expect(calls.every((c) => c.resource === 'doors/door-1/unlock')).toBe(true);
    expect(Object.keys(calls[0].query)).toHaveLength(0);
    expect(calls[1].query.entry_method).toBe('in');
    expect(calls[2].query.entry_method).toBe('out');
  });
});
