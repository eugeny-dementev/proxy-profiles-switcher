import {DEFAULT_BYPASS_LIST} from '../core/constants.js';
import {
  createExport,
  mergeImportedProfiles,
  parseImport
} from '../core/import.js';
import {
  assertUniqueProfileName,
  createProfileId,
  normalizeBypassList,
  normalizeProfile
} from '../core/profiles.js';
import {
  applyDirect,
  applyProfile,
  configMatchesProfile,
  deriveProxyStatus
} from '../core/proxy.js';
import {
  clearRuntimeStatus,
  loadState,
  saveState
} from '../core/storage.js';

const elements = {
  add: document.getElementById('add-profile'),
  bypass: document.getElementById('profile-bypass'),
  cancel: document.getElementById('cancel-edit'),
  confirmImport: document.getElementById('confirm-import'),
  count: document.getElementById('profile-count'),
  delete: document.getElementById('delete-profile'),
  editorTitle: document.getElementById('editor-title'),
  exportButton: document.getElementById('export-button'),
  form: document.getElementById('profile-form'),
  host: document.getElementById('profile-host'),
  id: document.getElementById('profile-id'),
  importButton: document.getElementById('import-button'),
  importDetails: document.getElementById('import-details'),
  importDialog: document.getElementById('import-dialog'),
  importFile: document.getElementById('import-file'),
  importMode: document.getElementById('import-mode'),
  importSummary: document.getElementById('import-summary'),
  list: document.getElementById('profile-list'),
  main: document.getElementById('page-shell'),
  name: document.getElementById('profile-name'),
  pageStatus: document.getElementById('page-status'),
  port: document.getElementById('profile-port'),
  scheme: document.getElementById('profile-scheme')
};

let state;
let selectedId = null;
let pendingImport = null;
let activeProfileId = null;

function cloneState(value) {
  return {
    schemaVersion: value.schemaVersion,
    profiles: value.profiles.map(profile => ({
      ...profile,
      bypassList: [...profile.bypassList]
    })),
    lastSelectedProfileId: value.lastSelectedProfileId
  };
}

function setPageStatus(message, kind = '') {
  elements.pageStatus.textContent = message;
  elements.pageStatus.className = 'page-status' + (kind ? ' ' + kind : '');
}

function clearFieldErrors() {
  for (const element of document.querySelectorAll('.field-error')) {
    element.textContent = '';
  }
}

function showFieldError(error) {
  const target = document.getElementById(error.field + '-error');
  if (target) {
    target.textContent = error.message;
    const input = document.querySelector('[name="' + error.field + '"]');
    input?.focus();
  }
}

function resetEditor() {
  selectedId = null;
  elements.id.value = '';
  elements.name.value = '';
  elements.scheme.value = 'http';
  elements.host.value = '127.0.0.1';
  elements.port.value = '';
  elements.bypass.value = DEFAULT_BYPASS_LIST.join('\n');
  elements.editorTitle.textContent = 'New profile';
  elements.delete.classList.add('hidden');
  clearFieldErrors();
  renderList();
  elements.name.focus();
}

function editProfile(profile) {
  selectedId = profile.id;
  elements.id.value = profile.id;
  elements.name.value = profile.name;
  elements.scheme.value = profile.scheme;
  elements.host.value = profile.host;
  elements.port.value = String(profile.port);
  elements.bypass.value = profile.bypassList.join('\n');
  elements.editorTitle.textContent = 'Edit ' + profile.name;
  elements.delete.classList.remove('hidden');
  clearFieldErrors();
  renderList();
}

function createOrderButton(label, title, disabled, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'order-button';
  button.textContent = label;
  button.title = title;
  button.setAttribute('aria-label', title);
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

async function moveProfile(index, offset) {
  const destination = index + offset;
  if (destination < 0 || destination >= state.profiles.length) {
    return;
  }
  const next = [...state.profiles];
  const [profile] = next.splice(index, 1);
  next.splice(destination, 0, profile);
  state.profiles = next;
  state = await saveState(state);
  renderList();
  setPageStatus('Profile order saved.');
}

function renderList() {
  elements.list.replaceChildren();
  elements.count.textContent = String(state?.profiles.length ?? 0);
  if (!state || state.profiles.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-library';
    empty.textContent = 'No profiles yet. Add one using the editor.';
    elements.list.append(empty);
    return;
  }

  state.profiles.forEach((profile, index) => {
    const row = document.createElement('div');
    row.className = 'library-row';

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'select-profile' +
      (selectedId === profile.id ? ' selected' : '');
    const name = document.createElement('span');
    name.className = 'row-name';
    name.textContent = profile.name +
      (activeProfileId === profile.id ? ' · active' : '');
    const detail = document.createElement('span');
    detail.className = 'row-detail';
    detail.textContent = profile.scheme.toUpperCase() + '  ' +
      profile.host + ':' + profile.port;
    select.append(name, detail);
    select.addEventListener('click', () => editProfile(profile));

    const order = document.createElement('div');
    order.className = 'order-controls';
    order.append(
      createOrderButton('↑', 'Move ' + profile.name + ' up', index === 0, () => {
        void moveProfile(index, -1);
      }),
      createOrderButton('↓', 'Move ' + profile.name + ' down', index === state.profiles.length - 1, () => {
        void moveProfile(index, 1);
      })
    );
    row.append(select, order);
    elements.list.append(row);
  });
}

function candidateFromForm() {
  return normalizeProfile({
    id: elements.id.value || createProfileId(),
    name: elements.name.value,
    scheme: elements.scheme.value,
    host: elements.host.value,
    port: elements.port.value,
    bypassList: normalizeBypassList(elements.bypass.value)
  });
}

async function refreshActiveState() {
  const setting = await chrome.proxy.settings.get({incognito: false});
  const status = deriveProxyStatus(setting, state.profiles);
  activeProfileId = status.activeProfileId;
  if (!status.canControl) {
    setPageStatus(status.controlMessage, 'error');
  }
  renderList();
  return {setting, status};
}

async function saveProfile(event) {
  event.preventDefault();
  clearFieldErrors();
  setPageStatus('');

  try {
    const candidate = candidateFromForm();
    assertUniqueProfileName(state.profiles, candidate, selectedId ?? '');
    const before = cloneState(state);
    const oldProfile = state.profiles.find(profile => profile.id === selectedId);
    const setting = await chrome.proxy.settings.get({incognito: false});
    const wasActive = oldProfile && configMatchesProfile(setting, oldProfile);
    const index = state.profiles.findIndex(profile => profile.id === selectedId);

    if (index === -1) {
      state.profiles.push(candidate);
    }
    else {
      state.profiles[index] = candidate;
    }
    state = await saveState(state);

    try {
      if (wasActive) {
        await applyProfile(candidate);
        state.lastSelectedProfileId = candidate.id;
        state = await saveState(state);
      }
    }
    catch (error) {
      state = await saveState(before);
      throw new Error('The profile was not saved because Chrome could not reapply it: ' + error.message);
    }

    selectedId = candidate.id;
    await clearRuntimeStatus();
    await chrome.runtime.sendMessage({type: 'refresh-action'}).catch(() => {});
    editProfile(candidate);
    await refreshActiveState();
    setPageStatus(candidate.name + ' saved.');
  }
  catch (error) {
    showFieldError(error);
    setPageStatus(error.message || String(error), 'error');
  }
}

async function deleteSelectedProfile() {
  const profile = state.profiles.find(item => item.id === selectedId);
  if (!profile) {
    return;
  }
  if (!window.confirm('Delete "' + profile.name + '"?')) {
    return;
  }

  try {
    const setting = await chrome.proxy.settings.get({incognito: false});
    const wasActive = configMatchesProfile(setting, profile);
    if (wasActive) {
      await applyDirect();
    }
    state.profiles = state.profiles.filter(item => item.id !== profile.id);
    if (state.lastSelectedProfileId === profile.id) {
      state.lastSelectedProfileId = null;
    }
    state = await saveState(state);
    await clearRuntimeStatus();
    activeProfileId = null;
    resetEditor();
    await chrome.runtime.sendMessage({type: 'refresh-action'}).catch(() => {});
    setPageStatus(
      profile.name + ' deleted.' +
      (wasActive ? ' Direct mode is active.' : '')
    );
  }
  catch (error) {
    setPageStatus(error.message || String(error), 'error');
  }
}

function exportProfiles() {
  const json = JSON.stringify(createExport(state), null, 2);
  const url = URL.createObjectURL(new Blob([json], {type: 'application/json'}));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'proxy-profiles-switcher-backup.json';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
  setPageStatus('Backup exported.');
}

function describeImport(preview, mergeResult, mode) {
  const lines = [
    'Source: ' + preview.sourceFormat,
    'Mode: ' + mode,
    'Profiles ready: ' + preview.profiles.length,
    'Will add: ' + mergeResult.added,
    'Will update: ' + mergeResult.updated
  ];
  if (preview.skipped.length) {
    lines.push('', 'Skipped:');
    for (const item of preview.skipped) {
      lines.push('• ' + item.name + ' — ' + item.reason);
    }
  }
  if (preview.ignored.length) {
    lines.push('', 'Ignored legacy metadata:');
    for (const item of preview.ignored) {
      lines.push('• ' + item);
    }
  }
  return lines.join('\n');
}

async function previewImport(file) {
  if (!file) {
    return;
  }
  if (file.size > 1024 * 1024) {
    throw new Error('Import files are limited to 1 MB.');
  }

  const input = JSON.parse(await file.text());
  const preview = parseImport(input);
  const mode = elements.importMode.value;
  const mergeResult = mergeImportedProfiles(state.profiles, preview.profiles, mode);
  if (mergeResult.profiles.length > 256) {
    throw new Error('The imported result exceeds the 256-profile limit.');
  }

  pendingImport = {preview, mergeResult, mode};
  elements.importSummary.textContent =
    preview.profiles.length + ' profile(s) can be imported. Importing never activates a proxy.';
  elements.importDetails.textContent = describeImport(preview, mergeResult, mode);
  elements.confirmImport.disabled = preview.profiles.length === 0;
  elements.importDialog.showModal();
}

async function confirmImport(event) {
  event.preventDefault();
  if (!pendingImport) {
    return;
  }

  const previousSelected = state.lastSelectedProfileId;
  state.profiles = pendingImport.mergeResult.profiles;
  state.lastSelectedProfileId = state.profiles.some(profile =>
    profile.id === previousSelected
  ) ? previousSelected : null;
  state = await saveState(state);
  selectedId = null;
  pendingImport = null;
  elements.importDialog.close();
  elements.importFile.value = '';
  resetEditor();
  await refreshActiveState();
  await chrome.runtime.sendMessage({type: 'refresh-action'}).catch(() => {});
  setPageStatus('Profiles imported. Chrome proxy settings were not changed.');
}

async function initialize() {
  try {
    state = await loadState();
    resetEditor();
    await refreshActiveState();
    elements.main.inert = false;
    elements.main.setAttribute('aria-busy', 'false');
    elements.name.focus();
    document.documentElement.dataset.ready = 'true';
  }
  catch (error) {
    document.documentElement.dataset.ready = 'error';
    setPageStatus(error.message || String(error), 'error');
  }
}

elements.add.addEventListener('click', resetEditor);
elements.cancel.addEventListener('click', resetEditor);
elements.delete.addEventListener('click', () => void deleteSelectedProfile());
elements.exportButton.addEventListener('click', exportProfiles);
elements.form.addEventListener('submit', event => void saveProfile(event));
elements.importButton.addEventListener('click', () => elements.importFile.click());
elements.importFile.addEventListener('change', event => {
  previewImport(event.target.files?.[0]).catch(error => {
    elements.importFile.value = '';
    setPageStatus(error.message || String(error), 'error');
  });
});
elements.confirmImport.addEventListener('click', event => void confirmImport(event));

void initialize();
