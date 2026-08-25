import {
  RUNTIME_STATUS_KEY,
  STORAGE_KEY
} from './core/constants.js';
import {deriveProxyStatus} from './core/proxy.js';
import {getRecentApplicationError} from './core/runtime-status.js';
import {
  clearRuntimeStatus,
  ensureState,
  loadRuntimeStatus,
  loadState
} from './core/storage.js';

let refreshRunning = false;
let refreshRequested = false;

async function refreshAction() {
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
    const applicationError = getRecentApplicationError(runtimeStatus);
    if (runtimeStatus && !applicationError) {
      await clearRuntimeStatus();
    }
    let badgeText = '';
    let badgeColor = '#64748b';
    let title = 'Proxy Profiles Switcher — Direct';

    if (!status.canControl) {
      badgeText = '!';
      badgeColor = '#dc2626';
      title = 'Proxy Profiles Switcher — ' + status.controlMessage;
    }
    else if (applicationError) {
      badgeText = '!';
      badgeColor = '#dc2626';
      title = 'Proxy Profiles Switcher — ' + applicationError.message;
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
