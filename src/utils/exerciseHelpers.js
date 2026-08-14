// src/utils/exerciseHelpers.js — localStorage helpers + Supabase sync via src/lib/sync.js

import { pushExercise, pushSession, deleteRemoteSession, deleteRemoteExercise } from '../lib/sync';
import { reportBackgroundFailure } from '../lib/clientDiagnosticsRuntime';
import { STORAGE_AVAILABLE } from './storageCheck';

const defaultExercises = [
  { id: 1, name: 'Bench Press',    muscleGroup: 'Chest',     type: 'Strength' },
  { id: 2, name: 'Squat',          muscleGroup: 'Legs',      type: 'Strength' },
  { id: 3, name: 'Deadlift',       muscleGroup: 'Back',      type: 'Strength' },
  { id: 4, name: 'Overhead Press', muscleGroup: 'Shoulders', type: 'Strength' },
  { id: 5, name: 'Bicep Curl',     muscleGroup: 'Arms',      type: 'Strength' },
  { id: 6, name: 'Pull-ups',       muscleGroup: 'Back',      type: 'Strength' },
  { id: 7, name: 'Tricep Dips',    muscleGroup: 'Arms',      type: 'Strength' },
  { id: 8, name: 'Plank',          muscleGroup: 'Core',      type: 'Strength' },
];

let logsLoadError = null;

export { defaultExercises };

function reportSyncFailure(error) {
  reportBackgroundFailure(error, { source: 'sync', category: 'unknown' });
}

// ── LocalStorage ─────────────────────────────────────────────────────────

export function loadExercises() {
  if (!STORAGE_AVAILABLE) return defaultExercises;
  try {
    const saved = localStorage.getItem('exercises');
    return saved ? JSON.parse(saved) : defaultExercises;
  } catch {
    return defaultExercises;
  }
}

export function loadLogs() {
  if (!STORAGE_AVAILABLE) {
    logsLoadError = 'storage-unavailable';
    return {};
  }
  try {
    const saved = localStorage.getItem('exerciseLogs');
    const parsed = saved ? JSON.parse(saved) : {};
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      logsLoadError = 'invalid-history';
      return {};
    }
    logsLoadError = null;
    return parsed;
  } catch {
    logsLoadError = 'invalid-history';
    return {};
  }
}

export function getLogsLoadError() {
  return logsLoadError;
}

/** Write logs directly (used by sync pull). Returns true only after a durable write. */
export function saveLogs(logs) {
  if (!STORAGE_AVAILABLE) return false;
  try {
    localStorage.setItem('exerciseLogs', JSON.stringify(logs));
    return true;
  } catch {
    return false;
  }
}

/** Write exercises directly (used by sync pull and Exercises page) */
export function saveExercisesRaw(exercises) {
  if (!STORAGE_AVAILABLE) return;
  localStorage.setItem('exercises', JSON.stringify(exercises));
}

/** Alias for backward-compat with Exercises.js */
export function saveExercises(exercises) {
  if (!STORAGE_AVAILABLE) return;
  localStorage.setItem('exercises', JSON.stringify(exercises));
}

/** Write plans directly (used by sync pull) */
export function savePlansRaw(plans) {
  if (!STORAGE_AVAILABLE) return;
  localStorage.setItem('workoutPlans', JSON.stringify(plans));
}

// ── Calculations ─────────────────────────────────────────────────────────

export function calcTotals(sets) {
  const totalReps   = sets.reduce((sum, s) => sum + (Number(s.reps)   || 0), 0);
  const totalVolume = sets.reduce(
    (sum, s) => sum + (Number(s.reps) || 0) * (Number(s.weight) || 0),
    0
  );
  return { totalReps, totalVolume };
}

export function isWarmupSet(set = {}) {
  return set.setType === 'warmup' || set.warmup === true;
}

export function bestSet(sets) {
  const workingSets = (sets || []).filter((set) => !isWarmupSet(set));
  if (workingSets.length === 0) return null;
  return workingSets.reduce((best, s) => {
    const score     = (Number(s.weight) || 0) * (1 + (Number(s.reps) || 0) / 30);
    const bestScore = (Number(best.weight) || 0) * (1 + (Number(best.reps) || 0) / 30);
    return score > bestScore ? s : best;
  }, workingSets[0]);
}

export function getRecords(sessions) {
  if (!sessions || sessions.length === 0) return { maxWeight: null, maxReps: null, maxVolume: null };
  let maxWeight = 0, maxReps = 0, maxVolume = 0;
  sessions.forEach(session => {
    const workingSets = session.sets.filter((set) => !isWarmupSet(set));
    workingSets.forEach(s => {
      const w = Number(s.weight) || 0;
      const r = Number(s.reps)   || 0;
      if (w > maxWeight) maxWeight = w;
      if (r > maxReps)   maxReps = r;
    });
    const workingVolume = workingSets.reduce((sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0), 0);
    if (workingVolume > maxVolume) maxVolume = workingVolume;
  });
  return { maxWeight, maxReps, maxVolume };
}

export function getSessionsAsc(logs, exerciseId) {
  const entry = logs[exerciseId];
  if (!entry) return [];
  return [...entry].sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function getSessionsDesc(logs, exerciseId) {
  const entry = logs[exerciseId];
  if (!entry) return [];
  return [...entry].sort((a, b) => new Date(b.date) - new Date(a.date));
}

function getSessionIdentity(session = {}) {
  const value = session || {};
  return value.clientSessionId || value.remoteId || value.id || value.sessionId || value.date;
}

function isDropsetChild(set = {}) {
  return set.dropSetChild === true || set.setType === 'dropset_child';
}

function normalizeValidReps(value) {
  if (value === '' || value === null || value === undefined) return null;
  const reps = Number(value);
  return Number.isFinite(reps) && Number.isInteger(reps) && reps > 0 ? reps : null;
}

function normalizeValidWeight(value) {
  if (value === '' || value === null || value === undefined) return null;
  const weight = Number(value);
  return Number.isFinite(weight) && weight >= 0 ? weight : null;
}

export function getBestExactSetRecord({
  logs,
  exerciseId,
  logicalSetNumber,
  reps,
  excludeSession = null,
}) {
  const normalizedReps = normalizeValidReps(reps);
  const normalizedSetNumber = Number(logicalSetNumber);
  if (normalizedReps === null || !Number.isInteger(normalizedSetNumber) || normalizedSetNumber <= 0) {
    return null;
  }

  const sessions = logs && typeof logs === 'object' && Array.isArray(logs[exerciseId])
    ? logs[exerciseId]
    : [];
  const excludedIdentity = typeof excludeSession === 'object'
    ? getSessionIdentity(excludeSession)
    : excludeSession;
  let maximumWeight = null;

  sessions.forEach((session) => {
    if (!session || session.deleted === true || session.isDeleted === true) return;
    if (excludedIdentity !== null && excludedIdentity !== undefined
      && getSessionIdentity(session) === excludedIdentity) return;

    let currentLogicalSetNumber = 0;
    const sessionSets = Array.isArray(session.sets) ? session.sets : [];
    sessionSets.forEach((set) => {
      if (!set || isWarmupSet(set) || isDropsetChild(set)) return;
      currentLogicalSetNumber += 1;
      if (currentLogicalSetNumber !== normalizedSetNumber
        || set.automaticPlaceholder === true
        || set.deleted === true
        || set.isDeleted === true) return;
      const historicalReps = normalizeValidReps(set.reps);
      const historicalWeight = normalizeValidWeight(set.weight);
      if (historicalReps !== normalizedReps || historicalWeight === null) return;
      if (maximumWeight === null || historicalWeight > maximumWeight) {
        maximumWeight = historicalWeight;
      }
    });
  });

  return maximumWeight === null ? null : { reps: normalizedReps, weight: maximumWeight };
}

function toFiniteNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getSetRepFeedback(currentSet, previousSet) {
  if (!previousSet) return { state: 'neutral', reason: 'missing-match', icon: '•', label: 'No matching set last time' };
  const currentWeight = toFiniteNumber(currentSet?.weight);
  const previousWeight = toFiniteNumber(previousSet?.weight);
  if (currentWeight === null || previousWeight === null || currentWeight !== previousWeight) {
    return { state: 'neutral', reason: 'different-weight', icon: '•', label: 'Different weight than last time' };
  }
  const currentReps = toFiniteNumber(currentSet?.reps);
  const previousReps = toFiniteNumber(previousSet?.reps);
  if (currentReps === null || previousReps === null) return { state: 'neutral', reason: 'missing-reps', icon: '•', label: 'No rep comparison available' };
  if (currentReps > previousReps) return { state: 'positive', reason: 'more-reps', icon: '▲', label: 'More reps than last time' };
  if (currentReps < previousReps) return { state: 'negative', reason: 'fewer-reps', icon: '▼', label: 'Fewer reps than last time' };
  return { state: 'neutral', reason: 'same-reps', icon: '•', label: 'Same reps as last time' };
}

export function getSessionRepFeedback(logs, exerciseId, sessionOrDate) {
  const sessions = getSessionsAsc(logs, exerciseId);
  if (sessions.length === 0) return [];
  const targetDate = typeof sessionOrDate === 'string' ? sessionOrDate : sessionOrDate?.date;
  if (!targetDate) return [];
  const targetSession = sessions.find((session) => session.date === targetDate) || (typeof sessionOrDate === 'object' ? sessionOrDate : null);
  if (!targetSession?.sets?.length) return [];
  const sessionIndex = sessions.findIndex((session) => session.date === targetDate);
  const previousSession = sessionIndex > 0
    ? sessions[sessionIndex - 1]
    : [...sessions].filter((session) => new Date(session.date) < new Date(targetDate)).at(-1) || null;
  return targetSession.sets.map((set, index) => getSetRepFeedback(set, previousSession?.sets?.[index]));
}

// ── Supabase sync helpers (delegated to src/lib/sync.js) ─────────────────

/**
 * Upsert an exercise to Supabase (fire-and-forget).
 */
export async function upsertExercise(exercise, userId) {
  return pushExercise(exercise, userId);
}

/**
 * Save a workout session to Supabase (fire-and-forget).
 * Returns the remote session id or null.
 */
export async function upsertSession(exerciseId, session, userId) {
  return pushSession(exerciseId, session, userId);
}

/**
 * Delete a single session from localStorage AND Supabase.
 * @param {string|number} exerciseId
 * @param {string} sessionDate — ISO date string used as the unique key
 * @param {string} userId — current user id (for Supabase delete)
 * @returns {object} updated logs
 */
export function deleteSession(exerciseId, sessionOrDate, userId) {
  const logs = loadLogs();
  const sessions = logs[exerciseId] || [];
  const requestedIdentity = typeof sessionOrDate === 'object'
    ? sessionOrDate.clientSessionId || sessionOrDate.remoteId || sessionOrDate.id || sessionOrDate.sessionId || sessionOrDate.date
    : sessionOrDate;
  const targetIndex = sessions.findIndex((session) => {
    const identity = session.clientSessionId || session.remoteId || session.id || session.sessionId || session.date;
    return identity === requestedIdentity;
  });
  const target = targetIndex >= 0 ? sessions[targetIndex] : null;
  const updated = {
    ...logs,
    [exerciseId]: sessions.filter((_session, index) => index !== targetIndex),
  };
  saveLogs(updated);

  // Fire-and-forget Supabase delete
  if (userId && target?.remoteId) {
    deleteRemoteSession(target.remoteId, userId).catch(reportSyncFailure);
  }

  return updated;
}

/**
 * Delete an exercise and all its sessions from localStorage AND Supabase.
 * @param {string|number} exerciseId
 * @param {string} userId
 */
export function deleteExerciseWithSessions(exerciseId, userId) {
  // Remove from logs
  const logs = loadLogs();
  const { [exerciseId]: _removed, ...remainingLogs } = logs;
  saveLogs(remainingLogs);

  // Remove from exercises list
  const exercises = loadExercises();
  const updatedExercises = exercises.filter((e) => String(e.id) !== String(exerciseId));
  saveExercisesRaw(updatedExercises);

  // Fire-and-forget Supabase delete
  if (userId) {
    deleteRemoteExercise(exerciseId, userId).catch(reportSyncFailure);
  }

  return { updatedExercises, updatedLogs: remainingLogs };
}
