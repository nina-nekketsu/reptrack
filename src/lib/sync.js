// src/lib/sync.js — Offline-first data sync with Supabase
//
// Architecture:
//   localStorage is the primary data store (app works offline).
//   When authenticated, changes are pushed to Supabase in the background.
//   On login / app load, data is pulled from Supabase and merged with localStorage.
//   Conflict resolution: last-write-wins (Supabase data overwrites local on pull).

import { supabase } from './supabase';
import {
  pullActiveWorkoutSession,
  pushActiveWorkoutSession as pushDedicatedActiveWorkoutSession,
} from './activeWorkoutSessionSync';
import { createMutationOutbox } from './mutationOutbox';
import { clientDiagnostics } from './clientDiagnosticsRuntime';

let _mutationOutbox = null;
let _snapshotListeners = [];
const LAST_SUCCESS_STORAGE_KEY = 'reptrackLastSuccessfulSyncAt';

function readLastSuccessfulSyncAt() {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(LAST_SUCCESS_STORAGE_KEY);
  } catch {
    return null;
  }
}

let _lastSuccessfulSyncAt = readLastSuccessfulSyncAt();

function notifySyncSnapshot() {
  const snapshot = getSyncSnapshot();
  _snapshotListeners.forEach((listener) => {
    try { listener(snapshot); } catch { /* one observer must not break sync */ }
  });
}

function markSuccessfulSync() {
  _lastSuccessfulSyncAt = new Date().toISOString();
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(LAST_SUCCESS_STORAGE_KEY, _lastSuccessfulSyncAt);
    } catch {
      // Keep truthful in-memory status when persistent storage is unavailable.
    }
  }
  notifySyncSnapshot();
}

function getMutationOutbox() {
  if (!_mutationOutbox) {
    _mutationOutbox = createMutationOutbox({
      storage: typeof localStorage === 'undefined' ? null : localStorage,
    });
    _mutationOutbox.subscribe(notifySyncSnapshot);
  }
  return _mutationOutbox;
}

async function executePendingMutation(operation) {
  if (operation.kind !== 'exercise/update') {
    throw Object.assign(new Error('Unsupported mutation kind'), { code: 'UNSUPPORTED_KIND' });
  }
  const { error } = await supabase
    .from('exercises')
    .upsert(operation.payload, { onConflict: 'id,user_id' });
  if (error) throw error;
}

export function listPendingMutations() {
  return getMutationOutbox().listPending();
}

export function retryPendingMutation(operationId) {
  return getMutationOutbox().retry(operationId);
}

export function getSyncSnapshot() {
  const operations = getMutationOutbox().listPending();
  return {
    status: _syncStatus,
    pendingCount: operations.filter((operation) => operation.status === 'pending').length,
    failedCount: operations.filter((operation) => operation.status === 'failed').length,
    syncingCount: operations.filter((operation) => operation.status === 'syncing').length,
    lastSuccessfulSyncAt: _lastSuccessfulSyncAt,
    operations,
  };
}

export function onSyncSnapshotChange(listener) {
  _snapshotListeners.push(listener);
  return () => {
    _snapshotListeners = _snapshotListeners.filter((candidate) => candidate !== listener);
  };
}

function classifySyncFailure(error = {}) {
  const code = String(error.code || '').toUpperCase();
  const message = String(error.message || '').toLowerCase();
  if (code === '401' || code === '403' || code.includes('AUTH') || code.includes('JWT')) {
    return 'auth-expired';
  }
  if (code.includes('NETWORK')
    || code.includes('FETCH')
    || message.includes('failed to fetch')
    || message.includes('network request failed')
    || message.includes('networkerror')
    || message === 'load failed'
    || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    return 'offline';
  }
  if (/^5\d\d$/.test(code) || code.includes('SERVER')) return 'server';
  return 'unknown';
}

export async function flushPendingMutations() {
  const outbox = getMutationOutbox();
  if (!supabase) {
    return {
      processed: 0,
      succeeded: 0,
      failed: 0,
      pending: outbox.pendingCount(),
    };
  }

  const totals = { processed: 0, succeeded: 0, failed: 0, pending: outbox.pendingCount() };
  do {
    const attemptsBefore = new Map(
      outbox.listPending().map((operation) => [operation.id, operation.attempts])
    );
    const result = await outbox.flush(executePendingMutation);
    outbox.listPending()
      .filter((operation) => (
        operation.status === 'failed'
        && operation.attempts > (attemptsBefore.get(operation.id) || 0)
      ))
      .forEach((operation) => {
        clientDiagnostics.incrementSyncFailure(classifySyncFailure(operation.lastError));
      });
    totals.processed += result.processed;
    totals.succeeded += result.succeeded;
    totals.failed += result.failed;
    totals.pending = outbox.pendingCount();
  } while (outbox.listPending().some((operation) => operation.status === 'pending'));
  if (totals.succeeded > 0 && outbox.pendingCount() === 0) markSuccessfulSync();
  return totals;
}

// ─── Status tracking ────────────────────────────────────────────────────
let _syncStatus = 'idle'; // 'idle' | 'syncing' | 'error' | 'offline'
let _listeners = [];

export function getSyncStatus() { return _syncStatus; }

export function onSyncStatusChange(fn) {
  _listeners.push(fn);
  return () => { _listeners = _listeners.filter(l => l !== fn); };
}

function setStatus(s) {
  _syncStatus = s;
  _listeners.forEach(fn => fn(s));
  notifySyncSnapshot();
}

function setSuccessfulStatus() {
  _syncStatus = 'idle';
  _listeners.forEach(fn => fn('idle'));
  markSuccessfulSync();
}

// ─── Pull: Supabase → localStorage ─────────────────────────────────────

export async function pullAll(userId) {
  if (!supabase || !userId) return;
  setStatus('syncing');

  try {
    const [exRes, plansRes, logsRes, settingsRes, timerRes] = await Promise.all([
      supabase.from('exercises').select('*').eq('user_id', userId),
      supabase.from('workout_plans').select('*').eq('user_id', userId),
      supabase.from('exercise_logs').select('*').eq('user_id', userId),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
      supabase.from('workout_timer_state').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (exRes.error) throw exRes.error;
    if (plansRes.error) throw plansRes.error;
    if (logsRes.error) throw logsRes.error;
    if (settingsRes.error) throw settingsRes.error;
    // Timer state pull is best-effort — don't throw on error
    if (timerRes.error) console.warn('[sync] timer state pull failed:', timerRes.error);

    // ── Merge exercises ──
    if (exRes.data && exRes.data.length > 0) {
      const remote = exRes.data.map(row => ({
        id: row.id,
        name: row.name,
        muscleGroup: row.muscle_group,
        type: row.type || 'Strength',
      }));
      // Merge: remote wins for matching IDs, keep local-only exercises
      const local = safeParseJSON(localStorage.getItem('exercises'), []);
      const merged = mergeById(local, remote);
      localStorage.setItem('exercises', JSON.stringify(merged));
    }

    // ── Merge workout plans ──
    if (plansRes.data && plansRes.data.length > 0) {
      const remote = plansRes.data.map(row => ({
        id: row.id,
        name: row.name,
        exercises: row.exercises || [],
        createdAt: row.created_at,
      }));
      const local = safeParseJSON(localStorage.getItem('workoutPlans'), []);
      const merged = mergeById(local, remote);
      localStorage.setItem('workoutPlans', JSON.stringify(merged));
    }

    // ── Merge exercise logs ──
    // Schema: each row is one session log: { id, user_id, exercise_id, date, sets, best_set, total_reps, total_volume }
    // localStorage format: { [exerciseId]: [ { date, sets, bestSet, totalReps, totalVolume }, ... ] }
    if (logsRes.data && logsRes.data.length > 0) {
      const local = safeParseJSON(localStorage.getItem('exerciseLogs'), {});
      const remoteMap = {};

      for (const row of logsRes.data) {
        const exId = row.exercise_id;
        if (!remoteMap[exId]) remoteMap[exId] = [];
        remoteMap[exId].push({
          date: row.date,
          sets: row.sets || [],
          bestSet: row.best_set || null,
          totalReps: row.total_reps || 0,
          totalVolume: row.total_volume || 0,
          remoteId: row.id,
        });
      }

      // Merge: combine local and remote sessions, deduplicate by date
      const merged = { ...local };
      for (const [exId, remoteSessions] of Object.entries(remoteMap)) {
        const localSessions = merged[exId] || [];
        const localDates = new Set(localSessions.map(s => s.date));
        for (const rs of remoteSessions) {
          if (!localDates.has(rs.date)) {
            localSessions.push(rs);
          }
        }
        merged[exId] = localSessions;
      }
      localStorage.setItem('exerciseLogs', JSON.stringify(merged));
    }

    // ── Merge user settings ──
    if (settingsRes.data && settingsRes.data.settings) {
      const settings = settingsRes.data.settings;
      // Restore individual localStorage keys from the settings blob
      if (settings.currentPlanId) {
        localStorage.setItem('currentPlanId', settings.currentPlanId);
      }
      if (settings.timerAutoStart !== undefined) {
        localStorage.setItem('timerAutoStart', settings.timerAutoStart ? 'true' : 'false');
      }
      // Restore timerRestDefaults (single JSON map)
      if (settings.timerRestDefaults) {
        localStorage.setItem('timerRestDefaults', JSON.stringify(settings.timerRestDefaults));
      }
    }

    // ── Merge timer state (cross-device) ──
    // Remote timer state takes precedence if it's newer than local
    if (timerRes.data && timerRes.data.state) {
      const localTimer = safeParseJSON(localStorage.getItem('workoutTimerState'), null);
      const remoteTimer = timerRes.data.state;
      // Use remote if no local state, or if remote is a running timer and local is idle
      if (!localTimer || localTimer.phase === 'idle') {
        localStorage.setItem('workoutTimerState', JSON.stringify(remoteTimer));
      }
    }

    await pullActiveWorkoutSession(supabase, userId);

    setSuccessfulStatus();
  } catch (err) {
    clientDiagnostics.incrementSyncFailure(classifySyncFailure(err));
    console.error('[sync] pullAll failed:', err);
    setStatus('error');
    throw err;
  }
}

// ─── Push: localStorage → Supabase ─────────────────────────────────────

export async function pushExercises(userId) {
  if (!supabase || !userId) return;
  const exercises = safeParseJSON(localStorage.getItem('exercises'), []);
  if (exercises.length === 0) return;

  const queuedExerciseIds = new Set(
    getMutationOutbox().listPending()
      .filter((operation) => (
        operation.kind === 'exercise/update'
        && operation.payload?.user_id === userId
      ))
      .map((operation) => String(operation.entityId))
  );
  const rows = exercises
    .filter((exercise) => !queuedExerciseIds.has(String(exercise.id)))
    .map(ex => ({
      id: String(ex.id),
      user_id: userId,
      name: ex.name,
      muscle_group: ex.muscleGroup,
      type: ex.type || 'Strength',
    }));

  if (rows.length === 0) return;
  const { error } = await supabase.from('exercises').upsert(rows, { onConflict: 'id,user_id' });
  if (error) throw error;
}

export async function pushPlans(userId) {
  if (!supabase || !userId) return;
  const plans = safeParseJSON(localStorage.getItem('workoutPlans'), []);
  if (plans.length === 0) return;

  const rows = plans.map(p => ({
    id: String(p.id),
    user_id: userId,
    name: p.name,
    exercises: p.exercises || [],
  }));

  const { error } = await supabase.from('workout_plans').upsert(rows, { onConflict: 'id,user_id' });
  if (error) throw error;
}

export async function pushLogs(userId) {
  if (!supabase || !userId) return;
  const logs = safeParseJSON(localStorage.getItem('exerciseLogs'), {});

  const rows = [];
  for (const [exerciseId, sessions] of Object.entries(logs)) {
    for (const session of sessions) {
      // Skip sessions that already have a remoteId (already pushed)
      if (session.remoteId) continue;
      rows.push({
        user_id: userId,
        exercise_id: String(exerciseId),
        date: session.date,
        sets: session.sets,
        best_set: session.bestSet || null,
        total_reps: session.totalReps || 0,
        total_volume: session.totalVolume || 0,
      });
    }
  }

  if (rows.length === 0) return;

  const { data, error } = await supabase.from('exercise_logs').insert(rows).select();
  if (error) {
    throw error;
  }

  // Mark sessions with their remoteId so we don't push them again
  if (data) {
    const logsCopy = safeParseJSON(localStorage.getItem('exerciseLogs'), {});
    for (const inserted of data) {
      const sessions = logsCopy[inserted.exercise_id];
      if (!sessions) continue;
      const match = sessions.find(s => s.date === inserted.date && !s.remoteId);
      if (match) match.remoteId = inserted.id;
    }
    localStorage.setItem('exerciseLogs', JSON.stringify(logsCopy));
  }
}

export async function pushSettings(userId) {
  if (!supabase || !userId) return;

  // Collect all settings into a single JSON blob
  const settings = {};

  // currentPlanId
  const currentPlanId = localStorage.getItem('currentPlanId');
  if (currentPlanId) settings.currentPlanId = currentPlanId;

  // timerAutoStart (boolean stored as 'true'/'false' string)
  const autoStart = localStorage.getItem('timerAutoStart');
  if (autoStart !== null) {
    settings.timerAutoStart = autoStart === 'true';
  }

  // timerRestDefaults (single JSON map: { exerciseId: seconds, ... })
  const restDefaults = safeParseJSON(localStorage.getItem('timerRestDefaults'), null);
  if (restDefaults && Object.keys(restDefaults).length > 0) {
    settings.timerRestDefaults = restDefaults;
  }

  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    settings,
  }, { onConflict: 'user_id' });

  if (error) throw error;
}

export async function pushActiveWorkoutSession(userId) {
  if (!supabase || !userId) return;
  try {
    return await pushDedicatedActiveWorkoutSession(supabase, userId);
  } catch (error) {
    console.error('[sync] pushActiveWorkoutSession:', error);
    return null;
  }
}

export async function pushAll(userId) {
  if (!supabase || !userId) return;
  setStatus('syncing');
  try {
    await Promise.all([
      pushExercises(userId),
      pushPlans(userId),
      pushLogs(userId),
      pushSettings(userId),
      pushDedicatedActiveWorkoutSession(supabase, userId),
    ]);
    setSuccessfulStatus();
  } catch (err) {
    clientDiagnostics.incrementSyncFailure(classifySyncFailure(err));
    console.error('[sync] pushAll failed:', err);
    setStatus('error');
  }
}

// ─── Delete helpers ────────────────────────────────────────────────────

/**
 * Delete a session from Supabase by its remote id.
 * The exercise_logs table is flat (one row = one session).
 */
export async function deleteRemoteSession(remoteId) {
  if (!supabase || !remoteId) return;
  const { error } = await supabase
    .from('exercise_logs')
    .delete()
    .eq('id', remoteId);
  if (error) console.error('[sync] deleteRemoteSession:', error);
}

/**
 * Delete an exercise and all its sessions from Supabase.
 */
export async function deleteRemoteExercise(exerciseId, userId) {
  if (!supabase || !userId) return;
  // Delete all sessions for this exercise first
  const { error: logsErr } = await supabase
    .from('exercise_logs')
    .delete()
    .eq('exercise_id', String(exerciseId))
    .eq('user_id', userId);
  if (logsErr) console.error('[sync] deleteRemoteExercise logs:', logsErr);

  // Delete the exercise itself
  const { error: exErr } = await supabase
    .from('exercises')
    .delete()
    .eq('id', String(exerciseId))
    .eq('user_id', userId);
  if (exErr) console.error('[sync] deleteRemoteExercise:', exErr);
}

// ─── Single-entity push helpers (fire-and-forget after local write) ────

export async function pushExercise(exercise, userId) {
  if (!exercise?.id || !userId) return undefined;
  const payload = {
    id: String(exercise.id),
    user_id: userId,
    name: exercise.name,
    muscle_group: exercise.muscleGroup,
    type: exercise.type || 'Strength',
  };
  getMutationOutbox().enqueue({
    kind: 'exercise/update',
    entityId: String(exercise.id),
    idempotencyKey: `${userId}:exercise:${exercise.id}`,
    payload,
  });
  return flushPendingMutations();
}

export async function pushPlan(plan, userId) {
  if (!supabase || !userId) return;
  const { error } = await supabase.from('workout_plans').upsert({
    id: String(plan.id),
    user_id: userId,
    name: plan.name,
    exercises: plan.exercises || [],
  }, { onConflict: 'id,user_id' });
  if (error) console.error('[sync] pushPlan:', error);
}

export async function pushSession(exerciseId, session, userId) {
  if (!supabase || !userId) return null;
  const { data, error } = await supabase.from('exercise_logs').insert({
    user_id: userId,
    exercise_id: String(exerciseId),
    date: session.date,
    sets: session.sets,
    best_set: session.bestSet || null,
    total_reps: session.totalReps || 0,
    total_volume: session.totalVolume || 0,
  }).select().single();

  if (error) {
    console.error('[sync] pushSession:', error);
    return null;
  }
  return data?.id || null;
}

export async function updateRemoteSession(remoteId, exerciseId, session, userId) {
  if (!supabase || !userId || !remoteId) return null;
  const { error } = await supabase.from('exercise_logs').update({
    sets: session.sets,
    best_set: session.bestSet || null,
    total_reps: session.totalReps || 0,
    total_volume: session.totalVolume || 0,
  }).eq('id', remoteId).eq('user_id', userId).eq('exercise_id', String(exerciseId));

  if (error) {
    console.error('[sync] updateRemoteSession:', error);
    return null;
  }
  return true;
}

// ─── Utilities ──────────────────────────────────────────────────────────

function safeParseJSON(str, fallback) {
  try {
    return str ? JSON.parse(str) : fallback;
  } catch {
    return fallback;
  }
}

function mergeById(local, remote) {
  const map = new Map();
  // Local first
  for (const item of local) {
    map.set(String(item.id), item);
  }
  // Remote overwrites
  for (const item of remote) {
    map.set(String(item.id), item);
  }
  return Array.from(map.values());
}
