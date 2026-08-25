import {
  ALLOWED_SCHEMES,
  DEFAULT_BYPASS_LIST,
  PROFILE_LIMITS,
  SCHEMA_VERSION
} from './constants.js';

export class ProfileValidationError extends Error {
  constructor(message, field = '') {
    super(message);
    this.name = 'ProfileValidationError';
    this.field = field;
  }
}

export function createProfileId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, byte => byte.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10).join('')
  ].join('-');
}

export function normalizeBypassList(value) {
  const values = Array.isArray(value)
    ? value
    : String(value ?? '').split(/[\n,]/);
  const unique = new Map();

  for (const item of values) {
    const entry = String(item ?? '').trim();
    if (!entry) {
      continue;
    }
    const key = entry.toLowerCase();
    if (!unique.has(key)) {
      unique.set(key, entry);
    }
  }

  return [...unique.values()];
}

function normalizeHost(value) {
  let host = String(value ?? '').trim();
  if (host.startsWith('[') && host.endsWith(']')) {
    host = host.slice(1, -1);
  }
  return host;
}

function normalizeName(value) {
  return String(value ?? '').trim().replace(/\s+/g, ' ');
}

export function normalizeProfile(candidate, options = {}) {
  const idFactory = options.idFactory ?? createProfileId;
  const profile = {
    id: String(candidate?.id ?? '').trim() || idFactory(),
    name: normalizeName(candidate?.name),
    scheme: String(candidate?.scheme ?? '').trim().toLowerCase(),
    host: normalizeHost(candidate?.host),
    port: Number(candidate?.port),
    bypassList: normalizeBypassList(
      candidate?.bypassList ?? DEFAULT_BYPASS_LIST
    )
  };

  validateProfile(profile);
  return profile;
}

export function validateProfile(profile) {
  if (!profile.id) {
    throw new ProfileValidationError('Profile ID is required.', 'id');
  }
  if (!profile.name) {
    throw new ProfileValidationError('Profile name is required.', 'name');
  }
  if (profile.name.length > PROFILE_LIMITS.maxNameLength) {
    throw new ProfileValidationError(
      'Profile name must be 64 characters or fewer.',
      'name'
    );
  }
  if (!ALLOWED_SCHEMES.includes(profile.scheme)) {
    throw new ProfileValidationError('Unsupported proxy protocol.', 'scheme');
  }
  if (!profile.host) {
    throw new ProfileValidationError('Proxy host is required.', 'host');
  }
  if (
    profile.host.length > PROFILE_LIMITS.maxHostLength ||
    /[^\x21-\x7e]/.test(profile.host) ||
    /[\s/@,]/.test(profile.host) ||
    profile.host.includes('://')
  ) {
    throw new ProfileValidationError(
      'Use an ASCII hostname or IP address without a URL scheme.',
      'host'
    );
  }
  if (!Number.isInteger(profile.port) || profile.port < 1 || profile.port > 65535) {
    throw new ProfileValidationError(
      'Proxy port must be an integer from 1 to 65535.',
      'port'
    );
  }
  if (!Array.isArray(profile.bypassList)) {
    throw new ProfileValidationError('Bypass list must be an array.', 'bypassList');
  }
  if (profile.bypassList.length > PROFILE_LIMITS.maxBypassEntries) {
    throw new ProfileValidationError(
      'Bypass list has too many entries.',
      'bypassList'
    );
  }

  for (const entry of profile.bypassList) {
    if (
      !entry ||
      entry.length > PROFILE_LIMITS.maxBypassEntryLength ||
      /[^\x20-\x7e]/.test(entry)
    ) {
      throw new ProfileValidationError(
        'Bypass entries must be printable ASCII strings.',
        'bypassList'
      );
    }
  }
}

export function assertUniqueProfileName(profiles, candidate, ignoredId = '') {
  const key = candidate.name.toLocaleLowerCase();
  const duplicate = profiles.some(profile =>
    profile.id !== ignoredId &&
    profile.name.toLocaleLowerCase() === key
  );
  if (duplicate) {
    throw new ProfileValidationError(
      'Profile names must be unique.',
      'name'
    );
  }
}

export function normalizeState(candidate, options = {}) {
  const source = candidate && typeof candidate === 'object' ? candidate : {};
  const rawProfiles = Array.isArray(source.profiles) ? source.profiles : [];
  if (rawProfiles.length > PROFILE_LIMITS.maxProfiles) {
    throw new ProfileValidationError('Too many profiles.', 'profiles');
  }

  const profiles = [];
  for (const rawProfile of rawProfiles) {
    const profile = normalizeProfile(rawProfile, options);
    assertUniqueProfileName(profiles, profile);
    profiles.push(profile);
  }

  const selected = String(source.lastSelectedProfileId ?? '');
  return {
    schemaVersion: SCHEMA_VERSION,
    profiles,
    lastSelectedProfileId: profiles.some(profile => profile.id === selected)
      ? selected
      : null
  };
}

export function emptyState() {
  return {
    schemaVersion: SCHEMA_VERSION,
    profiles: [],
    lastSelectedProfileId: null
  };
}
