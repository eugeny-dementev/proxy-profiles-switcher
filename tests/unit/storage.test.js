import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ensureState,
  loadState,
  saveState
} from '../../extension/core/storage.js';

function storageArea(initial = {}) {
  const data = structuredClone(initial);
  return {
    data,
    async get(key) {
      return {[key]: structuredClone(data[key])};
    },
    async set(values) {
      Object.assign(data, structuredClone(values));
    },
    async remove(key) {
      delete data[key];
    }
  };
}

test('initializes empty storage without selecting or applying a proxy', async () => {
  const area = storageArea();
  const state = await ensureState(area);
  assert.deepEqual(state, {
    schemaVersion: 1,
    profiles: [],
    lastSelectedProfileId: null
  });
  assert.deepEqual(area.data.proxyProfilesState, state);
});

test('round-trips normalized state', async () => {
  const area = storageArea();
  await saveState({
    schemaVersion: 1,
    profiles: [{
      id: 'work',
      name: ' Work ',
      scheme: 'HTTP',
      host: '127.0.0.1',
      port: '3328',
      bypassList: ['localhost']
    }],
    lastSelectedProfileId: 'work'
  }, area);
  const state = await loadState(area);

  assert.equal(state.profiles[0].name, 'Work');
  assert.equal(state.profiles[0].scheme, 'http');
  assert.equal(state.lastSelectedProfileId, 'work');
});
