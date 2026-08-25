import {
  applyDirect,
  applyProfile,
  deriveProxyStatus
} from '../core/proxy.js';
import {
  createApplicationErrorStatus,
  getRecentApplicationError
} from '../core/runtime-status.js';
import {
  clearRuntimeStatus,
  loadRuntimeStatus,
  loadState,
  saveRuntimeStatus,
  saveState
} from '../core/storage.js';

const elements = {
  list: document.getElementById('profile-list'),
  manage: document.getElementById('manage'),
  refresh: document.getElementById('refresh'),
  status: document.getElementById('status'),
  summary: document.getElementById('summary')
};

let busy = false;

function setMessage(message, kind = '') {
  elements.status.textContent = message;
  elements.status.className = 'status' + (kind ? ' ' + kind : '');
}

function profileRow({name, detail, active, disabled, onClick}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'profile-row' + (active ? ' active' : '');
  button.disabled = disabled;
  button.setAttribute('aria-pressed', String(active));

  const copy = document.createElement('span');
  copy.className = 'profile-copy';
  const title = document.createElement('span');
  title.className = 'profile-name';
  title.textContent = name;
  const subtitle = document.createElement('span');
  subtitle.className = 'profile-detail';
  subtitle.textContent = detail;
  copy.append(title, subtitle);

  const mark = document.createElement('span');
  mark.className = 'profile-mark';
  mark.setAttribute('aria-hidden', 'true');
  mark.textContent = '✓';
  button.append(copy, mark);
  button.addEventListener('click', onClick);
  return button;
}

async function finishSwitch(message) {
  await chrome.runtime.sendMessage({type: 'refresh-action'}).catch(() => {});
  setMessage(message, 'success');
  if (new URLSearchParams(location.search).has('stayOpen')) {
    busy = false;
    await render();
    return;
  }
  window.setTimeout(() => window.close(), 220);
}

async function reportSwitchError(error) {
  const status = createApplicationErrorStatus(error);
  await saveRuntimeStatus(status).catch(() => {});
  await chrome.runtime.sendMessage({type: 'refresh-action'}).catch(() => {});
  busy = false;
  await render();
  setMessage(status.message, 'error');
}

async function selectDirect() {
  if (busy) {
    return;
  }
  busy = true;
  setMessage('Switching to Direct…');
  try {
    await applyDirect();
    const state = await loadState();
    state.lastSelectedProfileId = null;
    await saveState(state);
    await clearRuntimeStatus();
    await finishSwitch('Direct connection is active.');
  }
  catch (error) {
    await reportSwitchError(error);
  }
}

async function selectProfile(profile) {
  if (busy) {
    return;
  }
  busy = true;
  setMessage('Activating ' + profile.name + '…');
  try {
    await applyProfile(profile);
    const state = await loadState();
    state.lastSelectedProfileId = profile.id;
    await saveState(state);
    await clearRuntimeStatus();
    await finishSwitch(profile.name + ' is active.');
  }
  catch (error) {
    await reportSwitchError(error);
  }
}

function renderEmptyState() {
  const empty = document.createElement('div');
  empty.className = 'empty';
  empty.textContent = 'No proxy profiles saved yet.';
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Add first profile';
  button.addEventListener('click', () => chrome.runtime.openOptionsPage());
  empty.append(document.createElement('br'), button);
  elements.list.append(empty);
}

export async function render() {
  elements.list.replaceChildren();
  setMessage('Reading Chrome proxy settings…');

  try {
    const [state, setting, runtimeStatus] = await Promise.all([
      loadState(),
      chrome.proxy.settings.get({incognito: false}),
      loadRuntimeStatus()
    ]);
    const status = deriveProxyStatus(setting, state.profiles);
    const disabled = busy || !status.canControl;

    elements.list.append(profileRow({
      name: 'Direct',
      detail: 'No browser proxy',
      active: status.isDirect,
      disabled,
      onClick: selectDirect
    }));

    for (const profile of state.profiles) {
      elements.list.append(profileRow({
        name: profile.name,
        detail: profile.scheme.toUpperCase() + '  ' + profile.host + ':' + profile.port,
        active: status.activeProfileId === profile.id,
        disabled,
        onClick: () => selectProfile(profile)
      }));
    }

    if (state.profiles.length === 0) {
      renderEmptyState();
    }

    elements.summary.textContent = state.profiles.length + ' saved profile' +
      (state.profiles.length === 1 ? '' : 's') + ' · local only';

    const applicationError = getRecentApplicationError(runtimeStatus);
    if (!status.canControl) {
      setMessage(status.controlMessage, 'error');
    }
    else if (applicationError) {
      setMessage(applicationError.message, 'error');
    }
    else if (status.isDirect) {
      setMessage('Direct connection is active.');
    }
    else if (status.activeProfileId) {
      const active = state.profiles.find(profile =>
        profile.id === status.activeProfileId
      );
      setMessage(active.name + ' is active.', 'success');
    }
    else if (status.isUnmatchedFixed) {
      setMessage('Chrome is using an unsaved proxy configuration.', 'error');
    }
    else {
      setMessage('Chrome is using a non-profile proxy mode.');
    }
  }
  catch (error) {
    setMessage(error.message || String(error), 'error');
  }
}

elements.manage.addEventListener('click', () => chrome.runtime.openOptionsPage());
elements.refresh.addEventListener('click', () => {
  busy = false;
  void render();
});

void render();
