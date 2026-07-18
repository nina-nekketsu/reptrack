export const COACH_STATE_STORAGE_KEYS = {
  profile: 'coach_profile',
  metadata: 'coach_metadata',
  cardio: 'coach_cardio',
};

function safeParseJSON(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMergeLocalPreserving(localValue, remoteValue) {
  if (!isPlainObject(localValue) || !isPlainObject(remoteValue)) return remoteValue;
  const merged = { ...localValue };
  Object.entries(remoteValue).forEach(([key, value]) => {
    merged[key] = deepMergeLocalPreserving(localValue[key], value);
  });
  return merged;
}

export function readLocalCoachState(storage = localStorage) {
  const state = {};
  Object.entries(COACH_STATE_STORAGE_KEYS).forEach(([key, storageKey]) => {
    const value = safeParseJSON(storage.getItem(storageKey), undefined);
    if (value !== undefined) state[key] = value;
  });
  return state;
}

export function toCoachStateRows(userId, storage = localStorage) {
  if (!userId) return [];
  return Object.entries(readLocalCoachState(storage))
    .filter(([, state]) => isPlainObject(state))
    .map(([key, state]) => ({
      user_id: userId,
      key,
      state,
    }));
}

export function applyRemoteCoachStateRows(rows = [], userId, storage = localStorage) {
  if (!userId || !Array.isArray(rows)) return false;
  let changed = false;

  rows.forEach((row) => {
    if (String(row?.user_id) !== String(userId)) return;
    const storageKey = COACH_STATE_STORAGE_KEYS[row.key];
    if (!storageKey || !isPlainObject(row.state)) return;

    const local = safeParseJSON(storage.getItem(storageKey), {});
    const merged = deepMergeLocalPreserving(local, row.state);
    storage.setItem(storageKey, JSON.stringify(merged));
    changed = true;
  });

  return changed;
}
