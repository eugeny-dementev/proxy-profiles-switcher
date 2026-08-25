import assert from 'node:assert/strict';
import test from 'node:test';

import {APPLICATION_ERROR_TTL_MS} from '../../extension/core/constants.js';
import {
  createApplicationErrorStatus,
  getRecentApplicationError
} from '../../extension/core/runtime-status.js';

test('creates a short-lived status for a proxy setting application error', () => {
  assert.deepEqual(
    createApplicationErrorStatus(new Error('Chrome rejected the setting.'), 1000),
    {
      kind: 'application-error',
      message: 'Chrome rejected the setting.',
      timestamp: 1000
    }
  );
});

test('returns only recent proxy setting application errors', () => {
  const status = createApplicationErrorStatus('Could not apply proxy.', 1000);
  assert.deepEqual(getRecentApplicationError(status, 1001), {
    message: 'Could not apply proxy.',
    timestamp: 1000
  });
  assert.equal(
    getRecentApplicationError(status, 1000 + APPLICATION_ERROR_TTL_MS),
    null
  );
});

test('ignores request-level Chrome proxy errors', () => {
  assert.equal(getRecentApplicationError({
    kind: 'proxy-error',
    message: 'net::ERR_TUNNEL_CONNECTION_FAILED',
    timestamp: 1000
  }, 1001), null);
});

test('ignores malformed and future application errors', () => {
  assert.equal(getRecentApplicationError({
    kind: 'application-error',
    message: '',
    timestamp: 1000
  }, 1001), null);
  assert.equal(getRecentApplicationError({
    kind: 'application-error',
    message: 'From the future',
    timestamp: 1002
  }, 1001), null);
});
