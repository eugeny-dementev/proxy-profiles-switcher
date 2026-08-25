import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ProfileValidationError,
  assertUniqueProfileName,
  normalizeBypassList,
  normalizeProfile,
  normalizeState
} from '../../extension/core/profiles.js';

const idFactory = () => '00000000-0000-4000-8000-000000000001';

test('normalizes a valid profile and removes duplicate bypass entries', () => {
  const profile = normalizeProfile({
    name: '  Work   proxy ',
    scheme: 'SOCKS5',
    host: '[::1]',
    port: '1080',
    bypassList: 'localhost, LOCALHOST\n192.168.0.0/16'
  }, {idFactory});

  assert.deepEqual(profile, {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'Work proxy',
    scheme: 'socks5',
    host: '::1',
    port: 1080,
    bypassList: ['localhost', '192.168.0.0/16']
  });
});

test('uses the safe local-network bypass defaults', () => {
  const profile = normalizeProfile({
    name: 'Work',
    scheme: 'http',
    host: '127.0.0.1',
    port: 3328
  }, {idFactory});

  assert(profile.bypassList.includes('<local>'));
  assert(profile.bypassList.includes('192.168.0.0/16'));
  assert(profile.bypassList.includes('127.0.0.1'));
});

test('rejects URL-like hosts and invalid ports', () => {
  assert.throws(() => normalizeProfile({
    name: 'Bad host',
    scheme: 'http',
    host: 'http://127.0.0.1',
    port: 3328
  }, {idFactory}), error =>
    error instanceof ProfileValidationError && error.field === 'host'
  );

  assert.throws(() => normalizeProfile({
    name: 'Bad port',
    scheme: 'http',
    host: '127.0.0.1',
    port: 70000
  }, {idFactory}), error =>
    error instanceof ProfileValidationError && error.field === 'port'
  );
});

test('enforces case-insensitively unique profile names', () => {
  const existing = normalizeProfile({
    id: 'one',
    name: 'Work',
    scheme: 'http',
    host: '127.0.0.1',
    port: 3328,
    bypassList: []
  });
  const duplicate = normalizeProfile({
    id: 'two',
    name: 'work',
    scheme: 'socks5',
    host: '127.0.0.1',
    port: 1080,
    bypassList: []
  });

  assert.throws(
    () => assertUniqueProfileName([existing], duplicate),
    /unique/
  );
});

test('normalizes persisted state and clears a missing selection', () => {
  const state = normalizeState({
    schemaVersion: 99,
    profiles: [{
      id: 'one',
      name: 'Work',
      scheme: 'http',
      host: '127.0.0.1',
      port: 3328,
      bypassList: []
    }],
    lastSelectedProfileId: 'missing'
  });

  assert.equal(state.schemaVersion, 1);
  assert.equal(state.lastSelectedProfileId, null);
  assert.equal(state.profiles.length, 1);
});

test('normalizes comma and newline separated bypass text', () => {
  assert.deepEqual(
    normalizeBypassList('localhost, 127.0.0.1\nlocalhost\n'),
    ['localhost', '127.0.0.1']
  );
});
