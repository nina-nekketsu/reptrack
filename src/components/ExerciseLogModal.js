import React, { useState, useRef } from 'react';
import SetTimer from './SetTimer';
import PRBlock from './PRBlock';
import ProgressGraphBlock from './ProgressGraphBlock';
import {
  calcTotals,
  bestSet,
  getSessionsDesc,
  loadLogs,
  saveLogs,
} from '../utils/exerciseHelpers';

/**
 * Full exercise logging modal — used by both Exercises page and ActiveWorkout page.
 *
 * Props:
 *   exercise   — { id, name, muscleGroup, ... }
 *   onClose    — callback when modal is dismissed
 *   onSaved    — callback after a session is saved (receives updated logs)
 *   logs       — current logs object (from parent state)
 */
export default function ExerciseLogModal({ exercise, onClose, onSaved, logs }) {
  const [sets, setSets] = useState([{ reps: '', weight: '' }]);
  const logScrollRef = useRef(null);

  function updateSet(index, field, value) {
    setSets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addSet() {
    setSets((prev) => [...prev, { reps: '', weight: '' }]);
  }

  function removeSet(index) {
    setSets((prev) => prev.filter((_, i) => i !== index));
  }

  function saveSession() {
    const validSets = sets.filter((s) => s.reps !== '' || s.weight !== '');
    if (validSets.length === 0) return;

    const best = bestSet(validSets);
    const session = {
      date: new Date().toISOString(),
      sets: validSets,
      bestSet: best,
      ...calcTotals(validSets),
    };

    const currentLogs = loadLogs();
    const updated = {
      ...currentLogs,
      [exercise.id]: [...(currentLogs[exercise.id] || []), session],
    };
    saveLogs(updated);

    // Fire custom event so BottomNav badge updates
    window.dispatchEvent(new Event('exerciseLogged'));

    if (onSaved) {
      onSaved(updated);
    }
    onClose();
  }

  function scrollToTop() {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  function lastSession(exerciseId) {
    const sessions = getSessionsDesc(logs, exerciseId);
    return sessions[0] || null;
  }

  const liveTotals = calcTotals(sets);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--log" onClick={(e) => e.stopPropagation()}>

        {/* Sticky timer zone */}
        <div id="log-timer-top" className="log-timer-zone">
          <h3 className="modal-title">{exercise.name}</h3>
          <p className="modal-sub">{exercise.muscleGroup} · Log your sets</p>
          <SetTimer exerciseId={exercise.id} onClose={onClose} />
        </div>

        {/* Scrollable body */}
        <div className="log-scroll-body" ref={logScrollRef}>
          <div className="modal-divider" />

          <PRBlock logs={logs} exerciseId={exercise.id} />
          <ProgressGraphBlock logs={logs} exerciseId={exercise.id} />

          {logs[exercise.id]?.length > 0 && <div className="modal-divider" />}

          <div className="sets-header">
            <span>Set</span>
            <span>Reps</span>
            <span>Weight (kg)</span>
            <span></span>
          </div>

          {sets.map((s, i) => {
            const allSessions = getSessionsDesc(logs, exercise.id);
            const recordForSet = allSessions.reduce((best, session) => {
              const setData = session.sets[i];
              if (!setData) return best;
              const vol = (Number(setData.reps) || 0) * (Number(setData.weight) || 0);
              return vol > best ? vol : best;
            }, 0);
            const currentVol = (Number(s.reps) || 0) * (Number(s.weight) || 0);
            const isRecord = currentVol > 0 && currentVol >= recordForSet && recordForSet > 0;

            return (
              <div className={`set-row ${isRecord ? 'set-row--record' : ''}`} key={i}>
                <span className="set-num">{isRecord ? '🏆' : i + 1}</span>
                <input
                  className="set-input"
                  type="number"
                  min="0"
                  placeholder="0"
                  value={s.reps}
                  onChange={(e) => updateSet(i, 'reps', e.target.value)}
                />
                <input
                  className="set-input"
                  type="number"
                  min="0"
                  step="0.5"
                  placeholder="0"
                  value={s.weight}
                  onChange={(e) => updateSet(i, 'weight', e.target.value)}
                />
                <button
                  className="remove-set-btn"
                  onClick={() => removeSet(i)}
                  disabled={sets.length === 1}
                >
                  ✕
                </button>
              </div>
            );
          })}

          <button className="add-set-btn" onClick={addSet}>
            + Add Set
          </button>

          {/* Live totals */}
          <div className="live-totals">
            <div className="total-pill">
              <span className="total-label">Total Reps</span>
              <span className="total-value">{liveTotals.totalReps}</span>
            </div>
            <div className="total-pill">
              <span className="total-label">Total Volume</span>
              <span className="total-value">{liveTotals.totalVolume.toLocaleString()} kg</span>
            </div>
          </div>

          {/* Progressive overload hint */}
          {(() => {
            const prev = lastSession(exercise.id);
            if (!prev) return null;
            const diff = liveTotals.totalVolume - prev.totalVolume;
            return (
              <div className={`overload-hint ${diff >= 0 ? 'positive' : 'negative'}`}>
                {diff >= 0
                  ? `▲ +${diff.toLocaleString()} kg vs last session — progressive overload!`
                  : `▼ ${Math.abs(diff).toLocaleString()} kg vs last session`}
              </div>
            );
          })()}

          <div className="modal-actions">
            <button
              className="btn-primary"
              onClick={saveSession}
              disabled={liveTotals.totalReps === 0 && liveTotals.totalVolume === 0}
            >
              Save Session
            </button>
            <button className="btn-secondary" onClick={onClose}>
              Cancel
            </button>
          </div>

          <button className="back-to-top-btn" onClick={scrollToTop} type="button">
            ↑ Back to timer
          </button>
        </div>

      </div>
    </div>
  );
}
