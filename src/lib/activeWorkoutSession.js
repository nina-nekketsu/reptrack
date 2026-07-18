export const ACTIVE_WORKOUT_KEY = 'activeWorkoutSession';
export const ACTIVE_WORKOUT_CHANGED_EVENT = 'activeWorkoutSessionChanged';
export const DEVICE_ID_KEY = 'reptrackDeviceId';

const ACTIVE_STATUS = 'active';
const ENDED_STATUS = 'ended';

function timestampOf(session) {
  const value = Date.parse(session?.updatedAt || session?.startedAt || '');
  return Number.isFinite(value) ? value : 0;
}

export function normalizeActiveWorkoutSession(session) {
  if (!session || typeof session !== 'object' || !session.planId || !session.startedAt) {
    return null;
  }

  const status = session.status === ENDED_STATUS ? ENDED_STATUS : ACTIVE_STATUS;

  return {
    ...session,
    planName: typeof session.planName === 'string' ? session.planName : '',
    updatedAt: session.updatedAt || session.startedAt,
    status,
    endedAt: status === ENDED_STATUS ? (session.endedAt || session.updatedAt || session.startedAt) : null,
    deviceId: session.deviceId || null,
  };
}

export function createActiveWorkoutSession({ planId, planName, now, deviceId }) {
  return normalizeActiveWorkoutSession({
    planId,
    planName,
    startedAt: now,
    updatedAt: now,
    status: ACTIVE_STATUS,
    endedAt: null,
    deviceId,
    completedExerciseIds: [],
  });
}

export function endActiveWorkoutSession(session, now) {
  const normalized = normalizeActiveWorkoutSession(session);
  if (!normalized) return null;

  return {
    ...normalized,
    updatedAt: now,
    status: ENDED_STATUS,
    endedAt: now,
  };
}

export function mergeActiveWorkoutSessions(localSession, remoteSession) {
  const local = normalizeActiveWorkoutSession(localSession);
  const remote = normalizeActiveWorkoutSession(remoteSession);

  if (!local) return remote;
  if (!remote) return local;

  const localTimestamp = timestampOf(local);
  const remoteTimestamp = timestampOf(remote);

  if (remoteTimestamp > localTimestamp) return remote;
  if (localTimestamp > remoteTimestamp) return local;

  if (local.status === ENDED_STATUS && remote.status !== ENDED_STATUS) return local;
  if (remote.status === ENDED_STATUS && local.status !== ENDED_STATUS) return remote;

  return remote;
}

export function getVisibleActiveWorkoutSession(session) {
  const normalized = normalizeActiveWorkoutSession(session);
  return normalized?.status === ACTIVE_STATUS ? normalized : null;
}

function defaultStorage() {
  return typeof localStorage === 'undefined' ? null : localStorage;
}

function createFallbackDeviceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateDeviceId(
  storage = defaultStorage(),
  randomUUID = createFallbackDeviceId
) {
  if (!storage) return randomUUID();

  try {
    const existing = storage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
    const created = randomUUID();
    storage.setItem(DEVICE_ID_KEY, created);
    return created;
  } catch {
    return randomUUID();
  }
}

function announceStoredSessionChange() {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    window.dispatchEvent(new Event(ACTIVE_WORKOUT_CHANGED_EVENT));
  }
}

export function readStoredActiveWorkoutSession(storage = defaultStorage()) {
  if (!storage) return null;

  try {
    const raw = storage.getItem(ACTIVE_WORKOUT_KEY);
    return normalizeActiveWorkoutSession(raw ? JSON.parse(raw) : null);
  } catch {
    return null;
  }
}

function writeStoredActiveWorkoutSession(session, storage = defaultStorage()) {
  const normalized = normalizeActiveWorkoutSession(session);
  if (!storage) return normalized;

  if (normalized) {
    storage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(normalized));
  } else {
    storage.removeItem(ACTIVE_WORKOUT_KEY);
  }

  announceStoredSessionChange();
  return normalized;
}

export function writeMergedActiveWorkoutSession(remoteSession, storage = defaultStorage()) {
  const localSession = readStoredActiveWorkoutSession(storage);
  const merged = mergeActiveWorkoutSessions(localSession, remoteSession);
  return writeStoredActiveWorkoutSession(merged, storage);
}

export function saveActiveWorkoutSession(command, storage = defaultStorage()) {
  const now = command?.now || new Date().toISOString();

  if (command?.action === 'start') {
    const session = createActiveWorkoutSession({
      planId: command.planId,
      planName: command.planName,
      now,
      deviceId: command.deviceId || getOrCreateDeviceId(storage),
    });
    if (!session) throw new Error('A planId and timestamp are required to start a workout');
    return writeStoredActiveWorkoutSession(session, storage);
  }

  if (command?.action === 'end') {
    const current = readStoredActiveWorkoutSession(storage);
    if (!current) return null;
    const sessionWithDeviceId = {
      ...current,
      deviceId: current.deviceId || getOrCreateDeviceId(storage),
    };
    return writeStoredActiveWorkoutSession(
      endActiveWorkoutSession(sessionWithDeviceId, now),
      storage
    );
  }

  if (command?.action === 'update') {
    const current = readStoredActiveWorkoutSession(storage);
    if (!current || current.status !== ACTIVE_STATUS) return null;
    const patch = command.patch && typeof command.patch === 'object' ? command.patch : {};
    return writeStoredActiveWorkoutSession({
      ...current,
      ...patch,
      planId: current.planId,
      startedAt: current.startedAt,
      status: ACTIVE_STATUS,
      endedAt: null,
      updatedAt: now,
      deviceId: current.deviceId || getOrCreateDeviceId(storage),
    }, storage);
  }

  throw new Error(`Unsupported active-workout action: ${command?.action || 'missing'}`);
}

export function getStoredVisibleActiveWorkoutSession(storage = defaultStorage()) {
  return getVisibleActiveWorkoutSession(readStoredActiveWorkoutSession(storage));
}
