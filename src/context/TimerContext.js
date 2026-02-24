// src/context/TimerContext.js
// Global persistent workout timer — timestamp-reconstruction architecture.
//
// Timer truth = timestamps, NOT intervals.
//   exercise elapsed = now - exerciseStartedAt - pausedDuration
//   rest remaining   = restEndAt - now
//
// Persistence layers:
//   1. React Context (in-memory, app-wide)
//   2. localStorage  (survives refresh / tab close)
//   3. Supabase      (cross-device, fire-and-forget)

import React, { createContext, useContext, useReducer, useEffect, useRef, useCallback } from 'react';
import { formatMs, playBeep, vibrate, loadAutoStart } from '../utils/timer';
import { supabase } from '../lib/supabase';

// ─── Constants ──────────────────────────────────────────────────────────────
const LS_KEY = 'workoutTimerState';
const THIRTY_MIN_MS = 30 * 60 * 1000;
const ALERT_THRESHOLD_MS = 5000;

// Timer phases
const PHASE_IDLE       = 'idle';
const PHASE_EXERCISING = 'exercising';
const PHASE_RESTING    = 'resting';
const PHASE_ALERT      = 'alert';

// ─── localStorage helpers ───────────────────────────────────────────────────
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch { /* quota exceeded — silent */ }
}

function clearPersistedState() {
  try {
    localStorage.removeItem(LS_KEY);
  } catch { /* silent */ }
}

// ─── Derive display values from timestamps ──────────────────────────────────
function deriveExerciseElapsed(state) {
  if (!state || !state.exerciseStartedAt) return 0;
  if (state.phase === PHASE_EXERCISING) {
    return Date.now() - state.exerciseStartedAt - (state.pausedDuration || 0);
  }
  // If we transitioned away from exercising, return the frozen value
  return state.exerciseElapsedFrozen || 0;
}

function deriveRestRemaining(state) {
  if (!state || !state.restEndAt) return 0;
  if (state.phase === PHASE_RESTING || state.phase === PHASE_ALERT) {
    return Math.max(0, state.restEndAt - Date.now());
  }
  return 0;
}

// ─── Initial state ──────────────────────────────────────────────────────────
function buildInitialState() {
  const saved = loadState();
  if (saved && saved.phase !== PHASE_IDLE) {
    // Validate saved state — check 30-min auto-stop
    if (saved.exerciseStartedAt) {
      const elapsed = Date.now() - saved.exerciseStartedAt - (saved.pausedDuration || 0);
      if (elapsed > THIRTY_MIN_MS) {
        clearPersistedState();
        return defaultState();
      }
    }
    // Check if rest countdown expired while we were away
    if ((saved.phase === PHASE_RESTING || saved.phase === PHASE_ALERT) && saved.restEndAt) {
      if (Date.now() >= saved.restEndAt) {
        // Rest ended while away — go idle
        clearPersistedState();
        return defaultState();
      }
    }
    return saved;
  }
  return defaultState();
}

function defaultState() {
  return {
    phase: PHASE_IDLE,
    exerciseId: null,          // which exercise the timer is for
    exerciseStartedAt: null,   // timestamp when exercise phase started
    pausedDuration: 0,         // total ms paused
    exerciseElapsedFrozen: 0,  // frozen elapsed when transitioning out of exercise
    restEndAt: null,           // absolute timestamp when rest ends
    restDurationMs: 0,         // configured rest duration for display when idle
  };
}

// ─── Reducer ────────────────────────────────────────────────────────────────
function timerReducer(state, action) {
  switch (action.type) {
    case 'START_EXERCISE': {
      return {
        ...state,
        phase: PHASE_EXERCISING,
        exerciseId: action.exerciseId,
        exerciseStartedAt: Date.now(),
        pausedDuration: 0,
        exerciseElapsedFrozen: 0,
        restEndAt: null,
      };
    }

    case 'START_REST': {
      const durationMs = action.durationMs;
      // Freeze exercise elapsed
      const frozen = deriveExerciseElapsed(state);
      return {
        ...state,
        phase: PHASE_RESTING,
        exerciseElapsedFrozen: frozen,
        exerciseStartedAt: null,
        pausedDuration: 0,
        restEndAt: Date.now() + durationMs,
        restDurationMs: durationMs,
      };
    }

    case 'ENTER_ALERT': {
      return { ...state, phase: PHASE_ALERT };
    }

    case 'REST_ENDED': {
      // If auto-start, go straight to exercising; otherwise idle
      if (action.autoStart) {
        return {
          ...state,
          phase: PHASE_EXERCISING,
          exerciseStartedAt: Date.now(),
          pausedDuration: 0,
          exerciseElapsedFrozen: 0,
          restEndAt: null,
        };
      }
      return {
        ...defaultState(),
        exerciseId: state.exerciseId,
        restDurationMs: state.restDurationMs,
      };
    }

    case 'RESET': {
      return defaultState();
    }

    case 'SET_EXERCISE_ID': {
      return { ...state, exerciseId: action.exerciseId };
    }

    case 'SET_REST_DURATION': {
      return { ...state, restDurationMs: action.durationMs };
    }

    case 'RESTORE': {
      return action.state;
    }

    default:
      return state;
  }
}

// ─── Context ────────────────────────────────────────────────────────────────
const TimerContext = createContext(null);

export function TimerProvider({ children }) {
  const [state, dispatch] = useReducer(timerReducer, null, buildInitialState);

  // Display values updated by tick
  const [exerciseDisplay, setExerciseDisplay] = React.useState('0:00');
  const [restDisplay, setRestDisplay]         = React.useState('0:00');
  const [flashIdx, setFlashIdx]               = React.useState(0);

  const stateRef     = useRef(state);
  const intervalRef  = useRef(null);
  const flashRef     = useRef(null);
  const restEndedRef = useRef(false); // guard against double-firing

  // Keep stateRef in sync
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // ── Persist to localStorage on every state change ──
  useEffect(() => {
    if (state.phase === PHASE_IDLE) {
      clearPersistedState();
    } else {
      persistState(state);
    }
  }, [state]);

  // ── Supabase sync (fire-and-forget) ──
  const syncToSupabase = useCallback((timerState) => {
    if (!supabase) return;
    // We'll get the user from supabase auth
    supabase.auth.getUser().then(({ data }) => {
      const userId = data?.user?.id;
      if (!userId) return;
      supabase.from('workout_timer_state').upsert({
        user_id: userId,
        state: timerState.phase === PHASE_IDLE ? null : timerState,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).then(({ error }) => {
        if (error) console.warn('[TimerContext] Supabase sync failed:', error);
      });
    });
  }, []);

  // Sync to Supabase on phase transitions (debounced)
  const prevPhaseRef = useRef(state.phase);
  useEffect(() => {
    if (state.phase !== prevPhaseRef.current) {
      prevPhaseRef.current = state.phase;
      syncToSupabase(state);
    }
  }, [state, syncToSupabase]);

  // ── Flash animation for alert phase ──
  const startFlash = useCallback(() => {
    if (flashRef.current) return;
    setFlashIdx(0);
    let idx = 0;
    flashRef.current = setInterval(() => {
      idx = (idx + 1) % 3;
      setFlashIdx(idx);
    }, 400);
  }, []);

  const stopFlash = useCallback(() => {
    if (flashRef.current) {
      clearInterval(flashRef.current);
      flashRef.current = null;
    }
    setFlashIdx(0);
  }, []);

  // ── Tick function — UI refresh only ──
  const tick = useCallback(() => {
    const s = stateRef.current;
    if (!s) return;

    if (s.phase === PHASE_EXERCISING) {
      const elapsed = deriveExerciseElapsed(s);
      setExerciseDisplay(formatMs(elapsed));

      // 30-min auto-stop
      if (elapsed >= THIRTY_MIN_MS) {
        dispatch({ type: 'RESET' });
        stopFlash();
        return;
      }
    }

    if (s.phase === PHASE_RESTING || s.phase === PHASE_ALERT) {
      const remaining = deriveRestRemaining(s);
      setRestDisplay(formatMs(remaining));

      // Enter alert phase
      if (s.phase === PHASE_RESTING && remaining <= ALERT_THRESHOLD_MS && remaining > 0) {
        dispatch({ type: 'ENTER_ALERT' });
        startFlash();
      }

      // Rest ended
      if (remaining <= 0 && !restEndedRef.current) {
        restEndedRef.current = true;
        stopFlash();
        vibrate();
        playBeep();
        const autoStart = loadAutoStart();
        dispatch({ type: 'REST_ENDED', autoStart });
      }
    }
  }, [startFlash, stopFlash]);

  // ── Start/stop interval based on phase ──
  useEffect(() => {
    if (state.phase !== PHASE_IDLE) {
      restEndedRef.current = false;
      if (!intervalRef.current) {
        intervalRef.current = setInterval(tick, 100);
      }
      // Immediate tick
      tick();
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      stopFlash();
      setExerciseDisplay('0:00');
      setRestDisplay('0:00');
    }

    // If entering alert from restored state, start flash
    if (state.phase === PHASE_ALERT) {
      startFlash();
    }

    return () => {
      // Cleanup only on unmount
    };
  }, [state.phase, tick, stopFlash, startFlash]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (flashRef.current) clearInterval(flashRef.current);
    };
  }, []);

  // ── Public API ────────────────────────────────────────────────────────────

  const startExercise = useCallback((exerciseId) => {
    stopFlash();
    dispatch({ type: 'START_EXERCISE', exerciseId: exerciseId || stateRef.current?.exerciseId });
  }, [stopFlash]);

  const startRest = useCallback((durationMs) => {
    const ms = durationMs || stateRef.current?.restDurationMs || 90000;
    dispatch({ type: 'START_REST', durationMs: ms });
  }, []);

  const reset = useCallback(() => {
    stopFlash();
    dispatch({ type: 'RESET' });
  }, [stopFlash]);

  const setExerciseId = useCallback((id) => {
    dispatch({ type: 'SET_EXERCISE_ID', exerciseId: id });
  }, []);

  const setRestDuration = useCallback((ms) => {
    dispatch({ type: 'SET_REST_DURATION', durationMs: ms });
  }, []);

  const stopAll = useCallback(() => {
    stopFlash();
    dispatch({ type: 'RESET' });
    clearPersistedState();
    syncToSupabase(defaultState());
  }, [stopFlash, syncToSupabase]);

  const value = {
    // State
    phase: state.phase,
    exerciseId: state.exerciseId,
    isIdle: state.phase === PHASE_IDLE,
    isExercising: state.phase === PHASE_EXERCISING,
    isResting: state.phase === PHASE_RESTING || state.phase === PHASE_ALERT,
    isAlert: state.phase === PHASE_ALERT,
    isRunning: state.phase !== PHASE_IDLE,

    // Display values (formatted strings, updated at 100ms)
    exerciseDisplay,
    restDisplay,
    flashIdx,

    // Raw ms values for components that need them
    exerciseElapsedMs: deriveExerciseElapsed(state),
    restRemainingMs: deriveRestRemaining(state),
    restDurationMs: state.restDurationMs,

    // Actions
    startExercise,
    startRest,
    reset,
    setExerciseId,
    setRestDuration,
    stopAll,
  };

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>;
}

export function useTimer() {
  const ctx = useContext(TimerContext);
  if (!ctx) throw new Error('useTimer must be used within TimerProvider');
  return ctx;
}

// Re-export constants for use in components
export { PHASE_IDLE, PHASE_EXERCISING, PHASE_RESTING, PHASE_ALERT };
