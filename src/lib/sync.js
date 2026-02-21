// src/lib/sync.js — Offline-first data sync with Supabase
//
// Architecture:
//   localStorage is the primary data store (app works offline).
//   When authenticated, changes are pushed to Supabase in the background.
//   On login / app load, data is pulled from Supabase and merged with localStorage.
//   Conflict resolution: last-write-wins (Supabase data overwrites local on pull).

import { supabase } from './supabase';

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
}

// ─── Pull: Supabase → localStorage ─────────────────────────────────────

export async function pullAll(userId) {
  if (!supabase || !userId) return;
  setStatus('syncing');

  try {
    const [exRes, plansRes, logsRes, settingsRes] = await Promise.all([
      supabase.from('exercises').select('*').eq('user_id', userId),
      supabase.from('workout_plans').select('*').eq('user_id', userId),
      supabase.from('exercise_logs').select('*').eq('user_id', userId),
      supabase.from('user_settings').select('*').eq('user_id', userId).maybeSingle(),
    ]);

    if (exRes.error) throw exRes.error;
    if (plansRes.error) throw plansRes.error;
    if (logsRes.error) throw logsRes.error;
    if (settingsRes.error) throw settingsRes.error;

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
      if (settings.autoStartTimer !== undefined) {
        localStorage.setItem('autoStartTimer', JSON.stringify(settings.autoStartTimer));
      }
      // Restore restDefaults_* keys
      if (settings.restDefaults) {
        for (const [key, val] of Object.entries(settings.restDefaults)) {
          localStorage.setItem(key, JSON.stringify(val));
        }
      }
    }

    setStatus('idle');
  } catch (err) {
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

  const rows = exercises.map(ex => ({
    id: String(ex.id),
    user_id: userId,
    name: ex.name,
    muscle_group: ex.muscleGroup,
    type: ex.type || 'Strength',
  }));

  const { error } = await supabase.from('exercises').upsert(rows, { onConflict: 'id,user_id' });
  if (error) console.error('[sync] pushExercises:', error);
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
  if (error) console.error('[sync] pushPlans:', error);
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
    console.error('[sync] pushLogs:', error);
    return;
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

  // autoStartTimer
  const autoStart = localStorage.getItem('autoStartTimer');
  if (autoStart !== null) {
    settings.autoStartTimer = safeParseJSON(autoStart, false);
  }

  // restDefaults_* keys
  const restDefaults = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('restDefaults_')) {
      restDefaults[key] = safeParseJSON(localStorage.getItem(key), null);
    }
  }
  if (Object.keys(restDefaults).length > 0) {
    settings.restDefaults = restDefaults;
  }

  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    settings,
  }, { onConflict: 'user_id' });

  if (error) console.error('[sync] pushSettings:', error);
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
    ]);
    setStatus('idle');
  } catch (err) {
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
  if (!supabase || !userId) return;
  const { error } = await supabase.from('exercises').upsert({
    id: String(exercise.id),
    user_id: userId,
    name: exercise.name,
    muscle_group: exercise.muscleGroup,
    type: exercise.type || 'Strength',
  }, { onConflict: 'id,user_id' });
  if (error) console.error('[sync] pushExercise:', error);
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
