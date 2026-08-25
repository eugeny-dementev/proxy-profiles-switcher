import {CONTROL_LEVELS} from './constants.js';

export function buildProxyConfig(profile) {
  const rules = {
    singleProxy: {
      scheme: profile.scheme,
      host: profile.host,
      port: Number(profile.port)
    }
  };
  if (profile.bypassList.length) {
    rules.bypassList = [...profile.bypassList];
  }

  return {
    mode: 'fixed_servers',
    rules
  };
}

export function buildDirectConfig() {
  return {mode: 'direct'};
}

function normalizeServer(server) {
  if (!server) {
    return null;
  }
  return {
    scheme: String(server.scheme ?? 'http').toLowerCase(),
    host: String(server.host ?? '').toLowerCase(),
    port: Number(server.port)
  };
}

function normalizeBypassList(list) {
  return [...new Set((list ?? []).map(entry =>
    String(entry).trim().toLowerCase()
  ).filter(Boolean))].sort();
}

export function configMatchesProfile(configOrSetting, profile) {
  const value = configOrSetting?.value ?? configOrSetting;
  if (value?.mode !== 'fixed_servers') {
    return false;
  }

  const expected = buildProxyConfig(profile);
  return JSON.stringify(normalizeServer(value.rules?.singleProxy)) ===
      JSON.stringify(normalizeServer(expected.rules.singleProxy)) &&
    JSON.stringify(normalizeBypassList(value.rules?.bypassList)) ===
      JSON.stringify(normalizeBypassList(expected.rules.bypassList));
}

export function isDirectConfig(configOrSetting) {
  const value = configOrSetting?.value ?? configOrSetting;
  return value?.mode === 'direct';
}

export function deriveProxyStatus(setting, profiles) {
  const levelOfControl = setting?.levelOfControl ?? CONTROL_LEVELS.CONTROLLABLE;
  const canControl = [
    CONTROL_LEVELS.CONTROLLABLE,
    CONTROL_LEVELS.CONTROLLED
  ].includes(levelOfControl);
  let controlMessage = '';

  if (levelOfControl === CONTROL_LEVELS.OTHER_EXTENSION) {
    controlMessage = 'Another extension currently controls Chrome proxy settings.';
  }
  else if (levelOfControl === CONTROL_LEVELS.NOT_CONTROLLABLE) {
    controlMessage = 'Chrome proxy settings are locked by policy or the browser.';
  }

  const activeProfile = profiles.find(profile =>
    configMatchesProfile(setting, profile)
  ) ?? null;

  return {
    canControl,
    controlMessage,
    levelOfControl,
    isDirect: isDirectConfig(setting),
    activeProfileId: activeProfile?.id ?? null,
    isUnmatchedFixed: setting?.value?.mode === 'fixed_servers' && !activeProfile
  };
}

async function setAndVerify(value, matcher, settings = chrome.proxy.settings) {
  await settings.set({value, scope: 'regular'});
  const applied = await settings.get({incognito: false});
  if (!matcher(applied)) {
    throw new Error('Chrome did not activate the requested proxy setting.');
  }
  return applied;
}

export function applyProfile(profile, settings = chrome.proxy.settings) {
  return setAndVerify(
    buildProxyConfig(profile),
    applied => configMatchesProfile(applied, profile),
    settings
  );
}

export function applyDirect(settings = chrome.proxy.settings) {
  return setAndVerify(
    buildDirectConfig(),
    isDirectConfig,
    settings
  );
}
