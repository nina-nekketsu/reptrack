export const CLIENT_DIAGNOSTICS_STORAGE_KEY = 'reptrackClientDiagnosticsV1';

const MAX_ERRORS = 20;
const MAX_MESSAGE_LENGTH = 240;
const ALLOWED_FAILURE_CATEGORIES = new Set(['offline', 'auth-expired', 'server', 'unknown']);

function emptyState() {
  return { errors: [], syncFailures: {} };
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sanitizeLabel(value, fallback) {
  return typeof value === 'string' && /^[a-z0-9-]{1,48}$/i.test(value) ? value : fallback;
}

function sanitizeMessage(error) {
  const raw = typeof error?.message === 'string'
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Unknown client error';
  return raw
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[REDACTED_EMAIL]')
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{8,}\b/g, '[REDACTED_JWT]')
    .replace(/Bearer\s+[^\s]+/gi, 'Bearer [REDACTED]')
    .replace(/\b((?:access_|refresh_)?token|api[_-]?key|secret|password|authorization)\b\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]')
    .slice(0, MAX_MESSAGE_LENGTH);
}

function normalizeState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return emptyState();
  const errors = Array.isArray(value.errors)
    ? value.errors.filter((entry) => (
      entry
      && typeof entry.source === 'string'
      && typeof entry.category === 'string'
      && typeof entry.message === 'string'
      && (typeof entry.occurredAt === 'number' || typeof entry.occurredAt === 'string')
    )).slice(-MAX_ERRORS)
    : [];
  const syncFailures = value.syncFailures && typeof value.syncFailures === 'object'
    ? Object.fromEntries(Object.entries(value.syncFailures).filter(([, count]) => Number.isInteger(count) && count >= 0))
    : {};
  return { errors, syncFailures };
}

export function createClientDiagnostics({
  storage = typeof localStorage === 'undefined' ? null : localStorage,
  now = Date.now,
  buildInfo = {},
} = {}) {
  let state = emptyState();

  function persist() {
    if (!storage) return;
    try {
      storage.setItem(CLIENT_DIAGNOSTICS_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Diagnostics remain usable in memory when browser storage is blocked.
    }
  }

  function load() {
    if (!storage) return emptyState();
    try {
      const raw = storage.getItem(CLIENT_DIAGNOSTICS_STORAGE_KEY);
      if (raw === null) return emptyState();
      return normalizeState(JSON.parse(raw));
    } catch {
      state = emptyState();
      persist();
      return state;
    }
  }

  state = load();

  function recordError(error, { source = 'application', category = 'runtime' } = {}) {
    const entry = {
      source: sanitizeLabel(source, 'application'),
      category: sanitizeLabel(category, 'runtime'),
      message: sanitizeMessage(error),
      occurredAt: now(),
    };
    state = {
      ...state,
      errors: [...state.errors, entry].slice(-MAX_ERRORS),
    };
    persist();
    return clone(entry);
  }

  function incrementSyncFailure(category = 'unknown') {
    const safeCategory = ALLOWED_FAILURE_CATEGORIES.has(category) ? category : 'unknown';
    state = {
      ...state,
      syncFailures: {
        ...state.syncFailures,
        [safeCategory]: (state.syncFailures[safeCategory] || 0) + 1,
      },
    };
    persist();
    return state.syncFailures[safeCategory];
  }

  function getStored() {
    return clone(state);
  }

  function getSnapshot(syncSnapshot = {}) {
    return {
      buildId: buildInfo.displayId || buildInfo.buildId || null,
      syncStatus: syncSnapshot.status || 'idle',
      queueDepth: Number(syncSnapshot.pendingCount || 0)
        + Number(syncSnapshot.failedCount || 0)
        + Number(syncSnapshot.syncingCount || 0),
      lastSuccessfulSyncAt: syncSnapshot.lastSuccessfulSyncAt || null,
      syncFailures: clone(state.syncFailures),
      errors: clone(state.errors),
    };
  }

  return {
    getSnapshot,
    getStored,
    incrementSyncFailure,
    recordError,
  };
}

export function installGlobalDiagnostics(windowLike, diagnostics) {
  if (!windowLike?.addEventListener || !diagnostics?.recordError) return () => {};
  const onError = (event) => diagnostics.recordError(event?.error || event?.message, {
    source: 'window',
    category: 'runtime',
  });
  const onUnhandledRejection = (event) => diagnostics.recordError(event?.reason, {
    source: 'window',
    category: 'unhandled-rejection',
  });
  windowLike.addEventListener('error', onError);
  windowLike.addEventListener('unhandledrejection', onUnhandledRejection);
  return () => {
    windowLike.removeEventListener('error', onError);
    windowLike.removeEventListener('unhandledrejection', onUnhandledRejection);
  };
}
