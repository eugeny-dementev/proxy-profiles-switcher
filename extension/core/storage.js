import {RUNTIME_STATUS_KEY, STORAGE_KEY} from './constants.js';
import {emptyState, normalizeState} from './profiles.js';

function storageGet(area, keys) {
  return area.get(keys);
}

function storageSet(area, values) {
  return area.set(values);
}

export async function loadState(area = chrome.storage.local) {
  const values = await storageGet(area, STORAGE_KEY);
  const raw = values?.[STORAGE_KEY];
  if (!raw) {
    return emptyState();
  }

  return normalizeState(raw);
}

export async function saveState(state, area = chrome.storage.local) {
  const normalized = normalizeState(state);
  await storageSet(area, {[STORAGE_KEY]: normalized});
  return normalized;
}

export async function ensureState(area = chrome.storage.local) {
  const state = await loadState(area);
  await saveState(state, area);
  return state;
}

export async function loadRuntimeStatus(area = chrome.storage.session) {
  const values = await storageGet(area, RUNTIME_STATUS_KEY);
  return values?.[RUNTIME_STATUS_KEY] ?? null;
}

export async function saveRuntimeStatus(status, area = chrome.storage.session) {
  await storageSet(area, {[RUNTIME_STATUS_KEY]: status});
}

export async function clearRuntimeStatus(area = chrome.storage.session) {
  await area.remove(RUNTIME_STATUS_KEY);
}
