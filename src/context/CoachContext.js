// src/context/CoachContext.js — Coach state management
// Manages coach profile, workout state, coaching metadata.
// All persisted to localStorage with coach_ prefix.

import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';

const CoachContext = createContext(null);

// ── localStorage keys ───────────────────────────────────────────────────
const LS_PROFILE   = 'coach_profile';
const LS_METADATA  = 'coach_metadata';
const LS_CARDIO    = 'coach_cardio';

// ── Defaults ────────────────────────────────────────────────────────────
function defaultProfile() {
  return {
    onboardingComplete: false,
    experience: null,          // 'never' | 'beginner' | 'intermediate' | 'advanced'
    daysPerWeek: null,
    sessionDuration: null,     // 60 | 90
    goal: null,                // 'hypertrophy' | 'strength'
    equipment: null,           // 'full-gym' | 'home' | 'bodyweight'
    injuries: [],
    planId: null,              // selected training plan template ID
    progression: 'conservative', // 'conservative' | 'moderate'
    weekNumber: 1,
    startDate: null,           // ISO date when coaching started
    // Personality
    encouragementStyle: 'balanced', // 'soft' | 'balanced' | 'tough' | 'aggressive'
    feedbackFrequency: 'normal',    // 'minimal' | 'normal' | 'detailed'
  };
}

function defaultMetadata() {
  return {
    bestOverloadLever: {},      // { [exerciseId]: 'weight' | 'reps' | 'rest' | 'tempo' | 'rir' }
    restPreferences: {},        // { [exerciseId]: seconds }
    plateauRisk: {},            // { [exerciseId]: number 0-100 }
    progressionConfidence: 50,
    allOutAllowed: false,
    injuryFlags: {},            // { [exerciseId]: string[] }
    fatigueScore: 0,            // 0-100
    lastSessionDate: null,
    totalSessions: 0,
  };
}

function defaultCardio() {
  return {
    weeklyLogs: [],   // [{ date: ISO, type: 'walk'|'run'|'bike'|'swim'|'other', minutes: number }]
    weeklyTarget: 150,
  };
}

// ── localStorage helpers ────────────────────────────────────────────────
function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback(), ...JSON.parse(raw) } : fallback();
  } catch {
    return fallback();
  }
}

function saveJSON(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch { /* silent */ }
}

// ── State shape ─────────────────────────────────────────────────────────
function buildInitialState() {
  return {
    profile:  loadJSON(LS_PROFILE,  defaultProfile),
    metadata: loadJSON(LS_METADATA, defaultMetadata),
    cardio:   loadJSON(LS_CARDIO,   defaultCardio),
    coachActive: false, // true during active workout
  };
}

// ── Reducer ─────────────────────────────────────────────────────────────
function coachReducer(state, action) {
  switch (action.type) {
    case 'SET_PROFILE':
      return { ...state, profile: { ...state.profile, ...action.payload } };

    case 'SET_METADATA':
      return { ...state, metadata: { ...state.metadata, ...action.payload } };

    case 'SET_CARDIO':
      return { ...state, cardio: { ...state.cardio, ...action.payload } };

    case 'ADD_CARDIO_LOG': {
      const newLogs = [...state.cardio.weeklyLogs, action.payload];
      return { ...state, cardio: { ...state.cardio, weeklyLogs: newLogs } };
    }

    case 'ACTIVATE_COACH':
      return { ...state, coachActive: true };

    case 'DEACTIVATE_COACH':
      return { ...state, coachActive: false };

    case 'RESET_COACH':
      return {
        profile: defaultProfile(),
        metadata: defaultMetadata(),
        cardio: defaultCardio(),
        coachActive: false,
      };

    default:
      return state;
  }
}

// ── Provider ────────────────────────────────────────────────────────────
export function CoachProvider({ children }) {
  const [state, dispatch] = useReducer(coachReducer, null, buildInitialState);

  // Persist on changes
  useEffect(() => { saveJSON(LS_PROFILE, state.profile); }, [state.profile]);
  useEffect(() => { saveJSON(LS_METADATA, state.metadata); }, [state.metadata]);
  useEffect(() => { saveJSON(LS_CARDIO, state.cardio); }, [state.cardio]);

  // ── Actions ─────────────────────────────────────────────────────────
  const updateProfile = useCallback((updates) => {
    dispatch({ type: 'SET_PROFILE', payload: updates });
  }, []);

  const updateMetadata = useCallback((updates) => {
    dispatch({ type: 'SET_METADATA', payload: updates });
  }, []);

  const completeOnboarding = useCallback((profileData) => {
    dispatch({
      type: 'SET_PROFILE',
      payload: {
        ...profileData,
        onboardingComplete: true,
        startDate: new Date().toISOString(),
        weekNumber: 1,
      },
    });
  }, []);

  const activateCoach = useCallback(() => {
    dispatch({ type: 'ACTIVATE_COACH' });
  }, []);

  const deactivateCoach = useCallback(() => {
    dispatch({ type: 'DEACTIVATE_COACH' });
  }, []);

  const addCardioLog = useCallback((log) => {
    dispatch({ type: 'ADD_CARDIO_LOG', payload: { ...log, date: new Date().toISOString() } });
  }, []);

  const resetCoach = useCallback(() => {
    dispatch({ type: 'RESET_COACH' });
    localStorage.removeItem(LS_PROFILE);
    localStorage.removeItem(LS_METADATA);
    localStorage.removeItem(LS_CARDIO);
  }, []);

  // ── Derived values ──────────────────────────────────────────────────
  const isOnboarded = state.profile.onboardingComplete;

  // Calculate weeks since start
  const weeksActive = state.profile.startDate
    ? Math.floor((Date.now() - new Date(state.profile.startDate).getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
    : 0;

  // Can use all-out? (needs 4+ weeks consistent training)
  const canUseAllOut = state.metadata.allOutAllowed && weeksActive >= 4;

  // Weekly cardio minutes (current week)
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weeklyCardioMinutes = state.cardio.weeklyLogs
    .filter(log => new Date(log.date) >= weekStart)
    .reduce((sum, log) => {
      const credit = log.type === 'walk' ? log.minutes * 0.5 : log.minutes;
      return sum + credit;
    }, 0);

  // Target RIR for the current week based on progression table
  function getTargetRIR() {
    const p = state.profile.progression;
    const w = weeksActive;
    if (p === 'conservative') {
      if (w <= 1) return '6-10';
      if (w <= 2) return '5';
      if (w <= 3) return '3-4';
      if (w <= 4) return '2-3';
      if (w <= 8) return '1-2';
      return '0'; // true all-out
    }
    // moderate
    if (w <= 1) return '3-4';
    if (w <= 2) return '2-3';
    if (w <= 3) return '1-2';
    return '0'; // true all-out
  }

  const value = {
    // State
    profile: state.profile,
    metadata: state.metadata,
    cardio: state.cardio,
    coachActive: state.coachActive,

    // Derived
    isOnboarded,
    weeksActive,
    canUseAllOut,
    weeklyCardioMinutes,
    cardioTarget: state.cardio.weeklyTarget,
    targetRIR: getTargetRIR(),

    // Actions
    updateProfile,
    updateMetadata,
    completeOnboarding,
    activateCoach,
    deactivateCoach,
    addCardioLog,
    resetCoach,
  };

  return <CoachContext.Provider value={value}>{children}</CoachContext.Provider>;
}

export function useCoach() {
  const ctx = useContext(CoachContext);
  if (!ctx) throw new Error('useCoach must be used within CoachProvider');
  return ctx;
}
