import {
  APPLICATION_ERROR_KIND,
  APPLICATION_ERROR_TTL_MS
} from './constants.js';

export function createApplicationErrorStatus(error, timestamp = Date.now()) {
  const message = String(error?.message ?? error ?? '').trim() ||
    'Chrome could not apply the requested proxy setting.';
  return {
    kind: APPLICATION_ERROR_KIND,
    message,
    timestamp
  };
}

export function getRecentApplicationError(status, now = Date.now()) {
  if (status?.kind !== APPLICATION_ERROR_KIND) {
    return null;
  }

  const timestamp = Number(status.timestamp);
  const age = now - timestamp;
  const message = String(status.message ?? '').trim();
  if (
    !Number.isFinite(timestamp) ||
    age < 0 ||
    age >= APPLICATION_ERROR_TTL_MS ||
    !message
  ) {
    return null;
  }

  return {message, timestamp};
}
