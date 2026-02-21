import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  createStopwatch,
  createCountdown,
  formatMs,
  playBeep,
  vibrate,
  loadRestDefault,
  saveRestDefault,
  loadAutoStart,
  saveAutoStart,
} from '../utils/timer';

// Timer state machine constants
const TIMER_IDLE       = 'idle';
const TIMER_EXERCISING = 'exercising';
const TIMER_RESTING    = 'resting';
const TIMER_ALERT      = 'alert';
const ALERT_THRESHOLD  = 5000;

// Flash colours for alert phase
const FLASH_COLORS = ['#ffffff', '#00cc44', '#000000'];

export default function SetTimer({ exerciseId, onClose }) {
  const [restSeconds, setRestSeconds] = useState(() => loadRestDefault(exerciseId));
  const [autoStart, setAutoStart]     = useState(loadAutoStart);

  const [timerState, setTimerState]   = useState(TIMER_IDLE);
  const [exerciseMs, setExerciseMs]   = useState(0);
  const [restMs, setRestMs]           = useState(0);
  const [flashIdx, setFlashIdx]       = useState(0);

  const stopwatchRef  = useRef(createStopwatch());
  const countdownRef  = useRef(null);
  const intervalRef   = useRef(null);
  const flashIntervalRef = useRef(null);
  const timerStateRef = useRef(TIMER_IDLE);
  const autoStartRef  = useRef(autoStart);

  useEffect(() => {
    autoStartRef.current = autoStart;
  }, [autoStart]);

  const tick = useCallback(() => {
    const state = timerStateRef.current;

    if (state === TIMER_EXERCISING) {
      setExerciseMs(stopwatchRef.current.getElapsed());
    }

    if (state === TIMER_RESTING || state === TIMER_ALERT) {
      const remaining = countdownRef.current?.getRemaining() ?? 0;
      setRestMs(remaining);

      if (state === TIMER_RESTING && remaining <= ALERT_THRESHOLD && remaining > 0) {
        enterAlert();
      }

      if (remaining <= 0 && (state === TIMER_RESTING || state === TIMER_ALERT)) {
        handleRestEnd();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function startInterval() {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(tick, 100);
  }

  function stopInterval() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  function startFlash() {
    if (flashIntervalRef.current) return;
    setFlashIdx(0);
    let idx = 0;
    flashIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % FLASH_COLORS.length;
      setFlashIdx(idx);
    }, 400);
  }

  function stopFlash() {
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    setFlashIdx(0);
  }

  function enterExercising() {
    stopwatchRef.current.reset();
    stopwatchRef.current.start();
    timerStateRef.current = TIMER_EXERCISING;
    setTimerState(TIMER_EXERCISING);
    setExerciseMs(0);
    startInterval();
  }

  function enterResting() {
    stopwatchRef.current.stop();
    stopwatchRef.current.reset();
    setExerciseMs(0);

    const durationMs = restSeconds * 1000;
    countdownRef.current = createCountdown(durationMs);
    countdownRef.current.start();

    timerStateRef.current = TIMER_RESTING;
    setTimerState(TIMER_RESTING);
    setRestMs(durationMs);
    startInterval();
  }

  function enterAlert() {
    timerStateRef.current = TIMER_ALERT;
    setTimerState(TIMER_ALERT);
    startFlash();
  }

  function handleRestEnd() {
    countdownRef.current?.reset();
    countdownRef.current = null;
    stopFlash();

    vibrate();
    playBeep();

    if (autoStartRef.current) {
      enterExercising();
    } else {
      timerStateRef.current = TIMER_IDLE;
      setTimerState(TIMER_IDLE);
      setRestMs(0);
      stopInterval();
    }
  }

  function resetAll() {
    stopwatchRef.current.stop();
    stopwatchRef.current.reset();
    countdownRef.current?.reset();
    countdownRef.current = null;
    stopInterval();
    stopFlash();
    timerStateRef.current = TIMER_IDLE;
    setTimerState(TIMER_IDLE);
    setExerciseMs(0);
    setRestMs(0);
  }

  function handleStart() {
    if (timerStateRef.current === TIMER_RESTING || timerStateRef.current === TIMER_ALERT) {
      countdownRef.current?.stop();
      stopFlash();
    }
    enterExercising();
  }

  function handleRest() {
    if (timerStateRef.current === TIMER_RESTING || timerStateRef.current === TIMER_ALERT) return;
    enterResting();
  }

  function handleStop() {
    resetAll();
  }

  useEffect(() => {
    const sw = stopwatchRef.current;
    const iv = intervalRef;
    const fi = flashIntervalRef;
    const cd = countdownRef;
    return () => {
      sw.stop();
      sw.reset();
      cd.current?.reset();
      clearInterval(iv.current);
      clearInterval(fi.current);
    };
  }, []);

  function handleRestSecondsChange(val) {
    const n = Math.max(5, Math.min(600, Number(val) || 90));
    setRestSeconds(n);
    saveRestDefault(exerciseId, n);
  }

  function handleAutoStartToggle() {
    const next = !autoStart;
    setAutoStart(next);
    saveAutoStart(next);
  }

  const isIdle       = timerState === TIMER_IDLE;
  const isExercising = timerState === TIMER_EXERCISING;
  const isResting    = timerState === TIMER_RESTING || timerState === TIMER_ALERT;
  const isAlert      = timerState === TIMER_ALERT;

  const flashColor = isAlert ? FLASH_COLORS[flashIdx] : 'transparent';
  const restTextColor = isAlert
    ? (flashColor === '#000000' ? '#ffffff' : '#000000')
    : '#e05555';

  return (
    <div className={`set-timer ${isAlert ? 'set-timer--alert' : ''}`}>
      {isAlert && (
        <div
          className="timer-flash-overlay"
          style={{ backgroundColor: flashColor }}
          aria-hidden="true"
        />
      )}

      <div className={`timer-block timer-block--exercise ${isExercising ? 'timer-block--active' : ''}`}>
        <div className="timer-label">Exercise Timer</div>
        <div className="timer-display timer-display--exercise">
          {formatMs(exerciseMs)}
        </div>
      </div>

      <div className={`timer-block timer-block--rest ${isResting ? 'timer-block--active' : ''} ${isAlert ? 'timer-block--alert' : ''}`}>
        <div className="timer-label">Rest Timer</div>
        <div
          className="timer-display timer-display--rest"
          style={isAlert ? { color: restTextColor, position: 'relative', zIndex: 2 } : {}}
        >
          {isResting ? formatMs(restMs) : formatMs(restSeconds * 1000)}
        </div>
        {isAlert && (
          <div className="timer-alert-label" style={{ color: restTextColor, position: 'relative', zIndex: 2 }}>
            GET READY!
          </div>
        )}
      </div>

      <div className="timer-controls">
        <button
          className={`timer-btn timer-btn--start ${isExercising ? 'timer-btn--active' : ''}`}
          onClick={handleStart}
          title={isExercising ? 'Already exercising' : isResting ? 'Cancel rest & start' : 'Start exercise timer'}
        >
          {isExercising ? '▶ Running' : isResting ? '▶ Start (cancel rest)' : '▶ Start'}
        </button>

        <button
          className={`timer-btn timer-btn--rest ${isResting ? 'timer-btn--active' : ''}`}
          onClick={handleRest}
          disabled={isResting}
          title={isResting ? 'Already resting' : 'Stop exercise & start rest'}
        >
          {isResting ? '💤 Resting…' : '💤 Rest'}
        </button>

        {!isIdle && (
          <button className="timer-btn timer-btn--stop" onClick={handleStop} title="Stop & reset">
            ✕ Reset
          </button>
        )}
      </div>

      <div className="timer-settings">
        <div className="timer-setting-row">
          <label className="timer-setting-label" htmlFor="rest-seconds">
            Rest duration (s)
          </label>
          <input
            id="rest-seconds"
            className="timer-setting-input"
            type="number"
            min="5"
            max="600"
            step="5"
            value={restSeconds}
            onChange={(e) => handleRestSecondsChange(e.target.value)}
            disabled={isResting}
          />
        </div>
        <div className="timer-setting-row">
          <label className="timer-setting-label" htmlFor="auto-start-toggle">
            Auto-start after rest
          </label>
          <button
            id="auto-start-toggle"
            className={`timer-toggle ${autoStart ? 'timer-toggle--on' : ''}`}
            onClick={handleAutoStartToggle}
            role="switch"
            aria-checked={autoStart}
          >
            <span className="timer-toggle-knob" />
          </button>
        </div>
      </div>
    </div>
  );
}
