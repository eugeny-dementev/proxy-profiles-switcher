export const APP_NAME = 'Proxy Profiles Switcher';
export const SCHEMA_VERSION = 1;
export const STORAGE_KEY = 'proxyProfilesState';
export const RUNTIME_STATUS_KEY = 'proxyProfilesRuntimeStatus';
export const EXPORT_FORMAT = 'proxy-profiles-switcher';

export const ALLOWED_SCHEMES = Object.freeze([
  'http',
  'https',
  'socks4',
  'socks5'
]);

export const DEFAULT_BYPASS_LIST = Object.freeze([
  '<local>',
  'localhost',
  '127.0.0.1',
  '[::1]',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16'
]);

export const PROFILE_LIMITS = Object.freeze({
  maxProfiles: 256,
  maxNameLength: 64,
  maxHostLength: 253,
  maxBypassEntries: 128,
  maxBypassEntryLength: 512
});

export const CONTROL_LEVELS = Object.freeze({
  CONTROLLABLE: 'controllable_by_this_extension',
  CONTROLLED: 'controlled_by_this_extension',
  OTHER_EXTENSION: 'controlled_by_other_extensions',
  NOT_CONTROLLABLE: 'not_controllable'
});
