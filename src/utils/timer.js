/**
 * timer.js — Clock-delta timer utilities
 *
 * All timers use system clock (Date.now) so they survive animation pauses,
 * tab switches, and throttled rAF. Interval tick is just for display refresh.
 */

import { STORAGE_AVAILABLE } from './storageCheck';

/**
 * Create a count-up stopwatch.
 * Returns { start, stop, reset, getElapsed }
 *
 * getElapsed() → elapsed milliseconds
 */
export function createStopwatch() {
  let startTime = null;
  let accumulated = 0; // ms accumulated before last stop
  let running = false;

  return {
    start() {
      if (running) return;
      startTime = Date.now();
      running = true;
    },
    stop() {
      if (!running) return;
      accumulated += Date.now() - startTime;
      startTime = null;
      running = false;
    },
    reset() {
      accumulated = 0;
      startTime = null;
      running = false;
    },
    getElapsed() {
      if (running) return accumulated + (Date.now() - startTime);
      return accumulated;
    },
    isRunning() {
      return running;
    },
  };
}

/**
 * Create a countdown timer.
 * @param {number} durationMs — total countdown duration in milliseconds
 * Returns { start, stop, reset, getRemaining, isExpired }
 *
 * getRemaining() → remaining ms (clamped to 0)
 */
export function createCountdown(durationMs) {
  let endTime = null;
  let running = false;
  let totalMs = durationMs;

  return {
    setDuration(ms) {
      totalMs = ms;
    },
    start() {
      if (running) return;
      endTime = Date.now() + totalMs;
      running = true;
    },
    stop() {
      if (!running) return;
      // Capture remaining so we can resume if needed (not used currently)
      totalMs = Math.max(0, endTime - Date.now());
      endTime = null;
      running = false;
    },
    reset(newDurationMs) {
      if (newDurationMs !== undefined) totalMs = newDurationMs;
      endTime = null;
      running = false;
    },
    getRemaining() {
      if (!running || endTime === null) return totalMs;
      return Math.max(0, endTime - Date.now());
    },
    isExpired() {
      if (!running) return false;
      return Date.now() >= endTime;
    },
    isRunning() {
      return running;
    },
  };
}

/** Format milliseconds → "M:SS" */
export function formatMs(ms) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/** Simple beep via Web Audio API */
export function playBeep() {
  if (!loadSoundEnabled()) return false;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);           // A5
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.3); // A4

    gain.gain.setValueAtTime(0.6, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);

    // Three beeps total
    [0.7, 1.4].forEach((delay) => {
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.connect(g2);
      g2.connect(ctx.destination);
      o2.type = 'sine';
      o2.frequency.setValueAtTime(880, ctx.currentTime + delay);
      o2.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + delay + 0.3);
      g2.gain.setValueAtTime(0.6, ctx.currentTime + delay);
      g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.6);
      o2.start(ctx.currentTime + delay);
      o2.stop(ctx.currentTime + delay + 0.6);
    });

    // Auto-close context after all beeps finish
    setTimeout(() => ctx.close(), 2200);
  } catch (e) {
    // Web Audio not available — silent fail
  }
}

/** Vibrate device if supported */
export function vibrate(pattern = [200, 100, 200, 100, 400]) {
  if (!loadHapticsEnabled()) return false;
  try {
    if (navigator.vibrate) {
      navigator.vibrate(pattern);
    }
  } catch (e) {
    // Not supported — silent fail
  }
}

/** LocalStorage helpers for rest defaults & auto-start */
const LS_REST_KEY = 'timerRestDefaults';
const LS_AUTOSTART_KEY = 'timerAutoStart';
const LS_SOUND_KEY = 'timerSoundEnabled';
const LS_HAPTICS_KEY = 'timerHapticsEnabled';

function loadBooleanPreference(key, defaultValue = true) {
  if (!STORAGE_AVAILABLE) return defaultValue;
  try {
    const value = localStorage.getItem(key);
    return value === null ? defaultValue : value === 'true';
  } catch {
    return defaultValue;
  }
}

function saveBooleanPreference(key, value) {
  if (!STORAGE_AVAILABLE) return;
  try { localStorage.setItem(key, String(Boolean(value))); } catch {}
}

export function loadSoundEnabled() { return loadBooleanPreference(LS_SOUND_KEY, true); }
export function saveSoundEnabled(value) { saveBooleanPreference(LS_SOUND_KEY, value); }
export function loadHapticsEnabled() { return loadBooleanPreference(LS_HAPTICS_KEY, true); }
export function saveHapticsEnabled(value) { saveBooleanPreference(LS_HAPTICS_KEY, value); }

export function loadRestDefault(exerciseId) {
  if (!STORAGE_AVAILABLE) return loadGlobalRestDefault();
  try {
    const map = JSON.parse(localStorage.getItem(LS_REST_KEY) || '{}');
    return typeof map[exerciseId] === 'number' ? map[exerciseId] : loadGlobalRestDefault();
  } catch {
    return loadGlobalRestDefault();
  }
}

export function saveRestDefault(exerciseId, seconds) {
  if (!STORAGE_AVAILABLE) return;
  try {
    const map = JSON.parse(localStorage.getItem(LS_REST_KEY) || '{}');
    map[exerciseId] = seconds;
    localStorage.setItem(LS_REST_KEY, JSON.stringify(map));
  } catch {}
}

export function loadAutoStart() {
  if (!STORAGE_AVAILABLE) return false;
  try {
    return localStorage.getItem(LS_AUTOSTART_KEY) === 'true';
  } catch {
    return false;
  }
}


/** Global default rest time (used when no per-exercise override exists) */
const LS_GLOBAL_REST_KEY = 'timerGlobalRestDefault';

export function loadGlobalRestDefault() {
  if (!STORAGE_AVAILABLE) return 90;
  try {
    const val = localStorage.getItem(LS_GLOBAL_REST_KEY);
    return val !== null ? Number(val) : 90;
  } catch {
    return 90;
  }
}

export function saveGlobalRestDefault(seconds) {
  if (!STORAGE_AVAILABLE) return;
  try {
    localStorage.setItem(LS_GLOBAL_REST_KEY, String(seconds));
  } catch {}
}

export function saveAutoStart(value) {
  if (!STORAGE_AVAILABLE) return;
  try {
    localStorage.setItem(LS_AUTOSTART_KEY, value ? 'true' : 'false');
  } catch {}
}
