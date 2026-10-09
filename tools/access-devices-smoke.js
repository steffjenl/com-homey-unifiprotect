'use strict';

const Module = require('module');

const originalLoad = Module._load;

Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'homey') {
    return { SimpleClass: class SimpleClass {} };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const AccessAPI = require('../library/access-api-v2/access-api');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

(async () => {
  const api = new AccessAPI();
  const payload = {
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
  };
  api.webclient = { get: async () => JSON.stringify(payload) };

  const intercoms = await api.getIntercoms();
  assert(intercoms.length === 1 && intercoms[0].unique_id === 'intercom-1', 'intercom in a later device group must be found');

  const readers = await api.getReaders();
  assert(readers.length === 2, `expected 2 unique readers, got ${readers.length}`);

  const hubs = await api.getHubs();
  assert(hubs.length === 1, 'expected 1 hub');

  console.log('access-devices smoke passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
