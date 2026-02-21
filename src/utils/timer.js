/**
 * timer.js — Clock-delta timer utilities
 *
 * All timers use system clock (Date.now) so they survive animation pauses,
 * tab switches, and throttled rAF. Interval tick is just for display refresh.
 */

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
export function vibrate() {
  try {
    if (navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 400]);
    }
  } catch (e) {
    // Not supported — silent fail
  }
}

/** LocalStorage helpers for rest defaults & auto-start */
const LS_REST_KEY = 'timerRestDefaults';
const LS_AUTOSTART_KEY = 'timerAutoStart';

export function loadRestDefault(exerciseId) {
  try {
    const map = JSON.parse(localStorage.getItem(LS_REST_KEY) || '{}');
    return typeof map[exerciseId] === 'number' ? map[exerciseId] : 90; // default 90s
  } catch {
    return 90;
  }
}

export function saveRestDefault(exerciseId, seconds) {
  try {
    const map = JSON.parse(localStorage.getItem(LS_REST_KEY) || '{}');
    map[exerciseId] = seconds;
    localStorage.setItem(LS_REST_KEY, JSON.stringify(map));
  } catch {}
}

export function loadAutoStart() {
  try {
    return localStorage.getItem(LS_AUTOSTART_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveAutoStart(value) {
  try {
    localStorage.setItem(LS_AUTOSTART_KEY, value ? 'true' : 'false');
  } catch {}
}
