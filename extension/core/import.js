import {EXPORT_FORMAT, PROFILE_LIMITS, SCHEMA_VERSION} from './constants.js';
import {
  assertUniqueProfileName,
  createProfileId,
  normalizeProfile
} from './profiles.js';

const LEGACY_RULE_KEYS = [
  'singleProxy',
  'proxyForHttp',
  'proxyForHttps',
  'proxyForFtp',
  'fallbackProxy'
];

function serverKey(server) {
  return [
    String(server.scheme ?? 'http').toLowerCase(),
    String(server.host ?? '').toLowerCase(),
    Number(server.port)
  ].join('|');
}

function importCurrentFormat(input, idFactory) {
  const rawProfiles = Array.isArray(input.profiles) ? input.profiles : [];
  if (rawProfiles.length > PROFILE_LIMITS.maxProfiles) {
    throw new Error('Import files are limited to 256 profiles.');
  }
  const profiles = [];
  const skipped = [];

  for (const rawProfile of rawProfiles) {
    try {
      const profile = normalizeProfile(rawProfile, {idFactory});
      assertUniqueProfileName(profiles, profile);
      profiles.push(profile);
    }
    catch (error) {
      skipped.push({
        name: String(rawProfile?.name ?? 'Unnamed profile'),
        reason: error.message
      });
    }
  }

  return {
    sourceFormat: 'current',
    profiles,
    skipped,
    ignored: []
  };
}

function importLegacyFormat(input, idFactory) {
  if (input.profiles.length > PROFILE_LIMITS.maxProfiles) {
    throw new Error('Import files are limited to 256 profiles.');
  }
  const profiles = [];
  const skipped = [];
  const ignored = [];

  for (const name of input.profiles) {
    const stored = input['profile.' + name];
    const value = stored?.value ?? stored;
    const rules = value?.rules ?? {};
    const servers = LEGACY_RULE_KEYS
      .map(key => rules[key])
      .filter(server => server?.host && server?.port);
    const distinctServers = new Map(
      servers.map(server => [serverKey(server), server])
    );

    if (distinctServers.size === 0) {
      skipped.push({name, reason: 'No usable proxy endpoint was found.'});
      continue;
    }
    if (distinctServers.size > 1) {
      skipped.push({
        name,
        reason: 'The profile uses multiple different endpoints and cannot be collapsed safely.'
      });
      continue;
    }

    try {
      const server = [...distinctServers.values()][0];
      const profile = normalizeProfile({
        id: idFactory(),
        name,
        scheme: server.scheme ?? 'http',
        host: server.host,
        port: server.port,
        bypassList: rules.bypassList ?? []
      }, {idFactory});
      assertUniqueProfileName(profiles, profile);
      profiles.push(profile);

      if ('remoteDNS' in value || 'noPrompt' in value) {
        ignored.push(
          name + ': legacy Remote DNS / No Prompt metadata was ignored.'
        );
      }
    }
    catch (error) {
      skipped.push({name, reason: error.message});
    }
  }

  return {
    sourceFormat: 'legacy-proxy-switcher',
    profiles,
    skipped,
    ignored
  };
}

export function parseImport(input, options = {}) {
  const idFactory = options.idFactory ?? createProfileId;
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('The selected file does not contain a settings object.');
  }

  const isLegacy = Array.isArray(input.profiles) &&
    input.profiles.every(item => typeof item === 'string');
  if (isLegacy) {
    return importLegacyFormat(input, idFactory);
  }

  const isCurrent = input.format === EXPORT_FORMAT ||
    input.schemaVersion === SCHEMA_VERSION;
  if (isCurrent) {
    return importCurrentFormat(input, idFactory);
  }

  throw new Error('Unsupported proxy profile backup format.');
}

export function mergeImportedProfiles(current, imported, mode = 'merge') {
  if (!['merge', 'replace'].includes(mode)) {
    throw new Error('Unsupported import mode.');
  }

  if (mode === 'replace') {
    return {
      profiles: imported.map(profile => ({...profile})),
      added: imported.length,
      updated: 0
    };
  }

  const profiles = current.map(profile => ({
    ...profile,
    bypassList: [...profile.bypassList]
  }));
  let added = 0;
  let updated = 0;

  for (const importedProfile of imported) {
    const index = profiles.findIndex(profile =>
      profile.id === importedProfile.id ||
      profile.name.toLocaleLowerCase() === importedProfile.name.toLocaleLowerCase()
    );
    if (index === -1) {
      profiles.push({...importedProfile, bypassList: [...importedProfile.bypassList]});
      added += 1;
      continue;
    }

    profiles[index] = {
      ...importedProfile,
      id: profiles[index].id,
      bypassList: [...importedProfile.bypassList]
    };
    updated += 1;
  }

  return {profiles, added, updated};
}

export function createExport(state, exportedAt = new Date().toISOString()) {
  return {
    format: EXPORT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    profiles: state.profiles.map(profile => ({
      ...profile,
      bypassList: [...profile.bypassList]
    }))
  };
}
