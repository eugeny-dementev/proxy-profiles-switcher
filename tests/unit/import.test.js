import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createExport,
  mergeImportedProfiles,
  parseImport
} from '../../extension/core/import.js';

let nextId = 0;
const idFactory = () => 'id-' + (++nextId);

test.beforeEach(() => {
  nextId = 0;
});

test('imports a legacy profile with identical protocol endpoints', () => {
  const preview = parseImport({
    profiles: ['Work'],
    'profile.Work': {
      value: {
        mode: 'fixed_servers',
        rules: {
          proxyForHttp: {scheme: 'http', host: '127.0.0.1', port: 3328},
          proxyForHttps: {scheme: 'http', host: '127.0.0.1', port: 3328},
          proxyForFtp: {scheme: 'http', host: '127.0.0.1', port: 3328},
          bypassList: ['localhost']
        },
        remoteDNS: false,
        noPrompt: false
      }
    }
  }, {idFactory});

  assert.equal(preview.sourceFormat, 'legacy-proxy-switcher');
  assert.equal(preview.profiles.length, 1);
  assert.deepEqual(preview.profiles[0], {
    id: 'id-1',
    name: 'Work',
    scheme: 'http',
    host: '127.0.0.1',
    port: 3328,
    bypassList: ['localhost']
  });
  assert.equal(preview.ignored.length, 1);
});

test('skips a legacy profile with different endpoints instead of guessing', () => {
  const preview = parseImport({
    profiles: ['Mixed'],
    'profile.Mixed': {
      value: {
        rules: {
          proxyForHttp: {scheme: 'http', host: '127.0.0.1', port: 3328},
          proxyForHttps: {scheme: 'socks5', host: '127.0.0.1', port: 1080}
        }
      }
    }
  }, {idFactory});

  assert.equal(preview.profiles.length, 0);
  assert.match(preview.skipped[0].reason, /multiple different endpoints/);
});

test('parses the versioned current backup format', () => {
  const preview = parseImport({
    format: 'proxy-profiles-switcher',
    schemaVersion: 1,
    profiles: [{
      id: 'work',
      name: 'Work',
      scheme: 'http',
      host: '127.0.0.1',
      port: 3328,
      bypassList: []
    }]
  }, {idFactory});

  assert.equal(preview.sourceFormat, 'current');
  assert.equal(preview.profiles[0].id, 'work');
});

test('merge updates matching names while preserving stable existing IDs', () => {
  const current = [{
    id: 'existing-id',
    name: 'Work',
    scheme: 'http',
    host: '127.0.0.1',
    port: 3328,
    bypassList: []
  }];
  const imported = [{
    id: 'import-id',
    name: 'work',
    scheme: 'socks5',
    host: '127.0.0.1',
    port: 1080,
    bypassList: ['localhost']
  }];

  const result = mergeImportedProfiles(current, imported, 'merge');
  assert.equal(result.added, 0);
  assert.equal(result.updated, 1);
  assert.equal(result.profiles[0].id, 'existing-id');
  assert.equal(result.profiles[0].port, 1080);
});

test('replace discards existing profiles and export is versioned', () => {
  const imported = [{
    id: 'new',
    name: 'New',
    scheme: 'https',
    host: 'proxy.example',
    port: 443,
    bypassList: []
  }];
  const result = mergeImportedProfiles([], imported, 'replace');
  const backup = createExport({
    profiles: result.profiles
  }, '2026-08-25T00:00:00.000Z');

  assert.equal(result.added, 1);
  assert.equal(backup.format, 'proxy-profiles-switcher');
  assert.equal(backup.schemaVersion, 1);
  assert.equal(backup.exportedAt, '2026-08-25T00:00:00.000Z');
});

test('rejects imports over the explicit profile limit', () => {
  assert.throws(() => parseImport({
    format: 'proxy-profiles-switcher',
    schemaVersion: 1,
    profiles: Array.from({length: 257}, (_, index) => ({
      name: 'Profile ' + index,
      scheme: 'http',
      host: '127.0.0.1',
      port: 3000 + index,
      bypassList: []
    }))
  }, {idFactory}), /limited to 256 profiles/);
});
