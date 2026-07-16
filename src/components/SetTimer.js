import React, { useEffect, useState } from 'react';
import { useTimer } from '../context/TimerContext';
import Sheet from './Sheet';
import {
  formatMs,
  loadRestDefault,
  saveRestDefault,
  loadAutoStart,
  saveAutoStart,
} from '../utils/timer';

const QUICK_REST_OPTIONS = [30, 60, 90, 120, 180, 240];

export default function SetTimer({ exerciseId }) {
  const timer = useTimer();
  const [restSeconds, setRestSeconds] = useState(() => loadRestDefault(exerciseId));
  const [autoStart, setAutoStart] = useState(loadAutoStart);
  const [restSheetOpen, setRestSheetOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    if (!exerciseId) return;
    timer.setExerciseId(exerciseId);
    const defaultRest = loadRestDefault(exerciseId);
    setRestSeconds(defaultRest);
    timer.setRestDuration(defaultRest * 1000);
  }, [exerciseId]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateRestSeconds(value) {
    const seconds = Math.max(5, Math.min(600, Number(value) || 90));
    setRestSeconds(seconds);
    saveRestDefault(exerciseId, seconds);
    timer.setRestDuration(seconds * 1000);
  }

  function chooseRest(seconds) {
    updateRestSeconds(seconds);
    setRestSheetOpen(false);
  }

  function toggleAutoStart() {
    const next = !autoStart;
    setAutoStart(next);
    saveAutoStart(next);
  }

  const activeIsRest = timer.isResting || timer.isAlert;
  const activeLabel = activeIsRest ? 'REST TIMER' : 'EXERCISE TIMER';
  const activeDisplay = activeIsRest
    ? timer.restDisplay
    : (timer.isExercising ? timer.exerciseDisplay : formatMs(timer.exerciseElapsedMs));
  const inactiveLabel = activeIsRest ? 'EXERCISE TIMER' : 'REST TIMER';
  const inactiveDisplay = activeIsRest
    ? formatMs(timer.exerciseElapsedMs)
    : formatMs(restSeconds * 1000);

  return (
    <section className={`set-timer set-timer--ds11 ${timer.isAlert ? 'set-timer--alert' : ''}`} aria-label="Set timer">
      <p className="sr-only" aria-live="polite">Rest started, {restSeconds} seconds</p>

      <div
        className={`timer-phase timer-phase--active ${timer.isAlert ? 'timer-phase--pulse' : ''}`}
        data-testid="timer-active-phase"
      >
        <span className="timer-phase__label">{activeLabel}</span>
        <strong className="timer-phase__display">{activeDisplay}</strong>
        {timer.isAlert && <span className="timer-phase__hint">Get ready</span>}
      </div>

      <div className="timer-phase timer-phase--inactive" data-testid="timer-inactive-phase">
        <span className="timer-phase__label">{inactiveLabel}</span>
        <span className="timer-phase__display timer-phase__display--small">{inactiveDisplay}</span>
      </div>

      <div className="timer-controls timer-controls--ds11">
        <button
          type="button"
          className={`timer-btn timer-btn--start ${timer.isExercising ? 'timer-btn--active' : ''}`}
          onClick={() => timer.startExercise(exerciseId)}
        >
          {timer.isExercising ? 'Running' : timer.isResting ? 'Start set' : 'Start'}
        </button>
        <button
          type="button"
          className={`timer-btn timer-btn--rest ${timer.isResting ? 'timer-btn--active' : ''}`}
          onClick={() => !timer.isResting && timer.startRest(restSeconds * 1000)}
          disabled={timer.isResting}
        >
          {timer.isResting ? 'Resting…' : 'Start rest'}
        </button>
        {!timer.isIdle && (
          <button type="button" className="timer-btn timer-btn--stop" onClick={timer.reset}>Reset</button>
        )}
      </div>

      <button
        type="button"
        className="timer-rest-picker"
        aria-label={`Choose rest duration, current ${restSeconds} seconds`}
        onClick={() => setRestSheetOpen(true)}
        disabled={timer.isResting}
      >
        <span>Rest duration</span>
        <strong>{restSeconds}s</strong>
      </button>

      <button
        type="button"
        className="timer-settings-toggle"
        aria-expanded={settingsOpen}
        onClick={() => setSettingsOpen((open) => !open)}
      >
        Rest settings
      </button>

      {settingsOpen && (
        <div className="timer-settings timer-settings--expanded">
          <label className="timer-setting-row" htmlFor="rest-seconds">
            <span className="timer-setting-label">Custom rest seconds</span>
            <input
              id="rest-seconds"
              aria-label="Custom rest seconds"
              className="timer-setting-input"
              type="number"
              min="5"
              max="600"
              step="5"
              value={restSeconds}
              onChange={(event) => updateRestSeconds(event.target.value)}
              disabled={timer.isResting}
            />
          </label>
          <div className="timer-setting-row">
            <span className="timer-setting-label">Auto-start next set after rest</span>
            <button
              type="button"
              className={`timer-toggle ${autoStart ? 'timer-toggle--on' : ''}`}
              onClick={toggleAutoStart}
              role="switch"
              aria-label="Auto-start next set after rest"
              aria-checked={autoStart}
            >
              <span className="timer-toggle-knob" aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      <Sheet open={restSheetOpen} onClose={() => setRestSheetOpen(false)} title="Choose rest duration" className="timer-rest-sheet">
        <p>Suggested 2–4 min for hard hypertrophy sets. Pick what matches this set.</p>
        <div className="timer-rest-options">
          {QUICK_REST_OPTIONS.map((seconds) => (
            <button
              type="button"
              key={seconds}
              className={seconds === restSeconds ? 'timer-rest-option timer-rest-option--active' : 'timer-rest-option'}
              onClick={() => chooseRest(seconds)}
            >
              {seconds}s
            </button>
          ))}
        </div>
      </Sheet>
    </section>
  );
}
