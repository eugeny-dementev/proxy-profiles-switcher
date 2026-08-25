import {
  RUNTIME_STATUS_KEY,
  STORAGE_KEY
} from './core/constants.js';
import {deriveProxyStatus} from './core/proxy.js';
import {
  clearRuntimeStatus,
  ensureState,
  loadRuntimeStatus,
  loadState,
  saveRuntimeStatus
} from './core/storage.js';

let refreshRunning = false;
let refreshRequested = false;

async function refreshAction(options = {}) {
  if (refreshRunning) {
    refreshRequested = true;
    return;
  }

  refreshRunning = true;
  try {
    const [state, setting, runtimeStatus] = await Promise.all([
      loadState(),
      chrome.proxy.settings.get({incognito: false}),
      loadRuntimeStatus()
    ]);
    const status = deriveProxyStatus(setting, state.profiles);
    const recentError = runtimeStatus &&
      Date.now() - Number(runtimeStatus.timestamp) < 5 * 60 * 1000;
    let badgeText = '';
    let badgeColor = '#64748b';
    let title = 'Proxy Profiles Switcher — Direct';

    if (options.forceError || recentError || !status.canControl) {
      badgeText = '!';
      badgeColor = '#dc2626';
      title = 'Proxy Profiles Switcher — ' +
        (options.forceError || runtimeStatus?.message || status.controlMessage);
    }
    else if (status.activeProfileId) {
      const profile = state.profiles.find(item =>
        item.id === status.activeProfileId
      );
      badgeText = 'ON';
      badgeColor = '#2563eb';
      title = 'Proxy Profiles Switcher — ' + profile.name;
    }
    else if (status.isUnmatchedFixed) {
      badgeText = '?';
      badgeColor = '#d97706';
      title = 'Proxy Profiles Switcher — Unmatched proxy configuration';
    }

    await Promise.all([
      chrome.action.setBadgeBackgroundColor({color: badgeColor}),
      chrome.action.setBadgeText({text: badgeText}),
      chrome.action.setTitle({title})
    ]);
  }
  catch (error) {
    await chrome.action.setBadgeBackgroundColor({color: '#dc2626'});
    await chrome.action.setBadgeText({text: '!'});
    await chrome.action.setTitle({
      title: 'Proxy Profiles Switcher — ' + (error.message || error)
    });
  }
  finally {
    refreshRunning = false;
    if (refreshRequested) {
      refreshRequested = false;
      void refreshAction();
    }
  }
}

async function initialize() {
  if (chrome.storage.local.setAccessLevel) {
    await chrome.storage.local.setAccessLevel({
      accessLevel: 'TRUSTED_CONTEXTS'
    });
  }
  await ensureState();
  await clearRuntimeStatus();
  await refreshAction();
}

chrome.runtime.onInstalled.addListener(() => {
  void initialize();
});

chrome.runtime.onStartup.addListener(() => {
  void refreshAction();
});

chrome.proxy.settings.onChange.addListener(() => {
  void clearRuntimeStatus();
  void refreshAction();
});

chrome.proxy.onProxyError.addListener(details => {
  const message = details.error || details.details || 'Unknown proxy error';
  void saveRuntimeStatus({
    kind: 'proxy-error',
    message,
    fatal: Boolean(details.fatal),
    timestamp: Date.now()
  });
  void refreshAction({forceError: message});
});

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (
    (areaName === 'local' && changes[STORAGE_KEY]) ||
    (areaName === 'session' && changes[RUNTIME_STATUS_KEY])
  ) {
    void refreshAction();
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== 'refresh-action') {
    return false;
  }

  refreshAction()
    .then(() => sendResponse({ok: true}))
    .catch(error => sendResponse({ok: false, error: error.message}));
  return true;
});

void refreshAction();
