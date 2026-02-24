import React, { useState, useEffect } from 'react';
import { useTimer } from '../context/TimerContext';
import {
  formatMs,
  loadRestDefault,
  saveRestDefault,
  loadAutoStart,
  saveAutoStart,
} from '../utils/timer';

// Flash colours for alert phase
const FLASH_COLORS = ['#ffffff', '#00cc44', '#000000'];

export default function SetTimer({ exerciseId }) {
  const timer = useTimer();

  const [restSeconds, setRestSeconds] = useState(() => loadRestDefault(exerciseId));
  const [autoStart, setAutoStart]     = useState(loadAutoStart);

  // When exerciseId changes, update the timer context and load per-exercise rest default
  useEffect(() => {
    if (exerciseId) {
      timer.setExerciseId(exerciseId);
      const defaultRest = loadRestDefault(exerciseId);
      setRestSeconds(defaultRest);
      timer.setRestDuration(defaultRest * 1000);
    }
  }, [exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleRestSecondsChange(val) {
    const n = Math.max(5, Math.min(600, Number(val) || 90));
    setRestSeconds(n);
    saveRestDefault(exerciseId, n);
    timer.setRestDuration(n * 1000);
  }

  function handleAutoStartToggle() {
    const next = !autoStart;
    setAutoStart(next);
    saveAutoStart(next);
  }

  function handleStart() {
    timer.startExercise(exerciseId);
  }

  function handleRest() {
    if (timer.isResting) return;
    timer.startRest(restSeconds * 1000);
  }

  function handleStop() {
    timer.reset();
  }

  const flashColor = timer.isAlert ? FLASH_COLORS[timer.flashIdx] : 'transparent';
  const restTextColor = timer.isAlert
    ? (flashColor === '#000000' ? '#ffffff' : '#000000')
    : '#e05555';

  return (
    <div className={`set-timer ${timer.isAlert ? 'set-timer--alert' : ''}`}>
      {timer.isAlert && (
        <div
          className="timer-flash-overlay"
          style={{ backgroundColor: flashColor }}
          aria-hidden="true"
        />
      )}

      <div className={`timer-block timer-block--exercise ${timer.isExercising ? 'timer-block--active' : ''}`}>
        <div className="timer-label">Exercise Timer</div>
        <div className="timer-display timer-display--exercise">
          {timer.isExercising ? timer.exerciseDisplay : formatMs(timer.exerciseElapsedMs)}
        </div>
      </div>

      <div className={`timer-block timer-block--rest ${timer.isResting ? 'timer-block--active' : ''} ${timer.isAlert ? 'timer-block--alert' : ''}`}>
        <div className="timer-label">Rest Timer</div>
        <div
          className="timer-display timer-display--rest"
          style={timer.isAlert ? { color: restTextColor, position: 'relative', zIndex: 2 } : {}}
        >
          {timer.isResting ? timer.restDisplay : formatMs(restSeconds * 1000)}
        </div>
        {timer.isAlert && (
          <div className="timer-alert-label" style={{ color: restTextColor, position: 'relative', zIndex: 2 }}>
            GET READY!
          </div>
        )}
      </div>

      <div className="timer-controls">
        <button
          className={`timer-btn timer-btn--start ${timer.isExercising ? 'timer-btn--active' : ''}`}
          onClick={handleStart}
          title={timer.isExercising ? 'Already exercising' : timer.isResting ? 'Cancel rest & start' : 'Start exercise timer'}
        >
          {timer.isExercising ? '▶ Running' : timer.isResting ? '▶ Start (cancel rest)' : '▶ Start'}
        </button>

        <button
          className={`timer-btn timer-btn--rest ${timer.isResting ? 'timer-btn--active' : ''}`}
          onClick={handleRest}
          disabled={timer.isResting}
          title={timer.isResting ? 'Already resting' : 'Stop exercise & start rest'}
        >
          {timer.isResting ? '💤 Resting…' : '💤 Rest'}
        </button>

        {!timer.isIdle && (
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
            disabled={timer.isResting}
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
