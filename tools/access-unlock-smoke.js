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

  assert(calls.every((c) => c.resource === 'doors/door-1/unlock'), 'unlock must target the door id');
  assert(Object.keys(calls[0].query).length === 0, 'no entry_method without argument');
  assert(calls[1].query.entry_method === 'in', 'entry_method=in expected');
  assert(calls[2].query.entry_method === 'out', 'entry_method=out expected');

  console.log('access-unlock smoke passed');
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
