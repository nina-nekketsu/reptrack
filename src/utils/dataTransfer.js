export const DATA_EXPORT_SCHEMA_VERSION = 1;

const ARRAY_KEYS = ['exercises', 'workoutPlans'];
const COACH_KEYS = {
  profile: 'coach_profile',
  metadata: 'coach_metadata',
  cardio: 'coach_cardio',
};
const SETTING_KEYS = {
  currentPlanId: { storageKey: 'currentPlanId', type: 'string' },
  timerAutoStart: { storageKey: 'timerAutoStart', type: 'boolean' },
  timerRestDefaults: { storageKey: 'timerRestDefaults', type: 'json' },
  timerGlobalRestDefault: { storageKey: 'timerGlobalRestDefault', type: 'number' },
};

function safeJSON(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function readSetting(storage, definition) {
  const raw = storage.getItem(definition.storageKey);
  if (raw === null) return undefined;
  if (definition.type === 'boolean') return raw === 'true';
  if (definition.type === 'number') {
    const numeric = Number(raw);
    return Number.isFinite(numeric) ? numeric : undefined;
  }
  if (definition.type === 'json') return safeJSON(storage, definition.storageKey, undefined);
  return raw;
}

function writeSetting(storage, definition, value) {
  if (definition.type === 'json') {
    storage.setItem(definition.storageKey, JSON.stringify(value));
  } else {
    storage.setItem(definition.storageKey, String(value));
  }
}

function identity(record, fallbackIndex) {
  return record?.id ?? record?.clientId ?? record?.name ?? `index:${fallbackIndex}`;
}

function sessionIdentity(session, fallbackIndex) {
  return session?.remoteId ?? session?.clientSessionId ?? session?.date ?? `index:${fallbackIndex}`;
}

function mergeArrayAdditively(current = [], incoming = []) {
  const seen = new Set(current.map(identity));
  return [
    ...current,
    ...incoming.filter((record, index) => {
      const key = identity(record, index);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

function mergeLogsAdditively(current = {}, incoming = {}) {
  const merged = { ...current };
  Object.entries(incoming).forEach(([exerciseId, sessions]) => {
    const existing = Array.isArray(merged[exerciseId]) ? merged[exerciseId] : [];
    merged[exerciseId] = mergeSessionsAdditively(existing, Array.isArray(sessions) ? sessions : []);
  });
  return merged;
}

function mergeSessionsAdditively(current = [], incoming = []) {
  const seen = new Set(current.map(sessionIdentity));
  return [
    ...current,
    ...incoming.filter((session, index) => {
      const key = sessionIdentity(session, index);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  ];
}

function validateSnapshot(snapshot) {
  if (!snapshot || snapshot.app !== 'RepTrack' || snapshot.schemaVersion !== DATA_EXPORT_SCHEMA_VERSION) {
    return 'Unsupported RepTrack export version';
  }
  const data = snapshot.data;
  if (!data || !Array.isArray(data.exercises) || !Array.isArray(data.workoutPlans)
    || !data.exerciseLogs || Array.isArray(data.exerciseLogs) || typeof data.exerciseLogs !== 'object') {
    return 'Malformed RepTrack export';
  }
  return null;
}

export function createDataExport(storage = localStorage, exportedAt = new Date().toISOString()) {
  const settings = {};
  Object.entries(SETTING_KEYS).forEach(([name, definition]) => {
    const value = readSetting(storage, definition);
    if (value !== undefined) settings[name] = value;
  });

  const coach = {};
  Object.entries(COACH_KEYS).forEach(([name, storageKey]) => {
    const value = safeJSON(storage, storageKey, undefined);
    if (value !== undefined) coach[name] = value;
  });

  return {
    app: 'RepTrack',
    schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
    exportedAt,
    data: {
      exercises: safeJSON(storage, 'exercises', []),
      workoutPlans: safeJSON(storage, 'workoutPlans', []),
      exerciseLogs: safeJSON(storage, 'exerciseLogs', {}),
      settings,
      coach,
    },
  };
}

export function previewDataImport(snapshot, storage = localStorage) {
  const error = validateSnapshot(snapshot);
  if (error) return { valid: false, error };

  const currentExercises = safeJSON(storage, 'exercises', []);
  const currentPlans = safeJSON(storage, 'workoutPlans', []);
  const importedExercises = snapshot.data.exercises;
  const importedPlans = snapshot.data.workoutPlans;
  const exerciseIds = new Set(currentExercises.map(identity));
  const planIds = new Set(currentPlans.map(identity));
  let sessionsToAdd = 0;
  let sessionsToKeep = 0;
  const currentLogs = safeJSON(storage, 'exerciseLogs', {});
  Object.entries(snapshot.data.exerciseLogs).forEach(([exerciseId, sessions]) => {
    const seen = new Set((currentLogs[exerciseId] || []).map(sessionIdentity));
    (Array.isArray(sessions) ? sessions : []).forEach((session, index) => {
      if (seen.has(sessionIdentity(session, index))) sessionsToKeep += 1;
      else sessionsToAdd += 1;
    });
  });

  return {
    valid: true,
    summary: {
      exercises: {
        add: importedExercises.filter((record, index) => !exerciseIds.has(identity(record, index))).length,
        keep: importedExercises.filter((record, index) => exerciseIds.has(identity(record, index))).length,
      },
      workoutPlans: {
        add: importedPlans.filter((record, index) => !planIds.has(identity(record, index))).length,
        keep: importedPlans.filter((record, index) => planIds.has(identity(record, index))).length,
      },
      sessions: { add: sessionsToAdd, keep: sessionsToKeep },
    },
  };
}

export function applyDataImport(snapshot, storage = localStorage) {
  const preview = previewDataImport(snapshot, storage);
  if (!preview.valid) throw new Error(preview.error);

  ARRAY_KEYS.forEach((key) => {
    const current = safeJSON(storage, key, []);
    storage.setItem(key, JSON.stringify(mergeArrayAdditively(current, snapshot.data[key])));
  });

  const currentLogs = safeJSON(storage, 'exerciseLogs', {});
  storage.setItem('exerciseLogs', JSON.stringify(mergeLogsAdditively(currentLogs, snapshot.data.exerciseLogs)));

  Object.entries(snapshot.data.settings || {}).forEach(([name, value]) => {
    const definition = SETTING_KEYS[name];
    if (definition && storage.getItem(definition.storageKey) === null) writeSetting(storage, definition, value);
  });

  Object.entries(snapshot.data.coach || {}).forEach(([name, value]) => {
    const storageKey = COACH_KEYS[name];
    if (!storageKey || !value || typeof value !== 'object' || Array.isArray(value)) return;
    const current = safeJSON(storage, storageKey, {});
    storage.setItem(storageKey, JSON.stringify({ ...value, ...current }));
  });

  window.dispatchEvent(new Event('storage'));
  return preview;
}
