import React, { useState, useRef } from 'react';
import SetTimer from './SetTimer';
import VolumeGraph from './VolumeGraph';
import {
  calcTotals,
  bestSet,
  getSessionsDesc,
  getSessionsAsc,
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
  const [graphOpen, setGraphOpen] = useState(false);
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

  // ── Compute all-time record set (by volume = reps × weight) ──
  function getAllTimeRecord() {
    const sessions = getSessionsDesc(logs, exercise.id);
    if (sessions.length === 0) return null;
    let best = null;
    let bestVol = 0;
    let bestSetIndex = 0;
    sessions.forEach((session) => {
      session.sets.forEach((s, idx) => {
        const vol = (Number(s.reps) || 0) * (Number(s.weight) || 0);
        if (vol > bestVol) {
          bestVol = vol;
          best = s;
          bestSetIndex = idx + 1; // 1-based set number
        }
      });
    });
    if (!best || bestVol === 0) return null;
    return { set: best, setIndex: bestSetIndex, volume: bestVol };
  }

  // ── Compute previous session's best set (by volume) ──
  function getPrevSessionBest() {
    const sessions = getSessionsDesc(logs, exercise.id);
    if (sessions.length === 0) return null;
    const prev = sessions[0]; // most recent session
    if (!prev.sets || prev.sets.length === 0) return null;
    let best = null;
    let bestVol = 0;
    let bestSetIndex = 0;
    prev.sets.forEach((s, idx) => {
      const vol = (Number(s.reps) || 0) * (Number(s.weight) || 0);
      if (vol > bestVol) {
        bestVol = vol;
        best = s;
        bestSetIndex = idx + 1;
      }
    });
    if (!best || bestVol === 0) return null;
    return { set: best, setIndex: bestSetIndex, date: prev.date };
  }

  const liveTotals = calcTotals(sets);
  const allTimeRecord = getAllTimeRecord();
  const prevSessionBest = getPrevSessionBest();
  const sessionsAsc = getSessionsAsc(logs, exercise.id);
  const hasHistory = sessionsAsc.length > 0;

  const prev = lastSession(exercise.id);
  const overloadDiff = prev ? liveTotals.totalVolume - prev.totalVolume : null;

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

          {/* ── Insights panel: record + prev session + graph ── */}
          {hasHistory && (
            <div className="insights-panel">
              <div className="insights-panel__rows">
                {/* All-time record set */}
                {allTimeRecord && (
                  <div className="insights-row">
                    <span className="insights-icon">🏆</span>
                    <div className="insights-content">
                      <span className="insights-label">All-time record</span>
                      <span className="insights-value">
                        {allTimeRecord.set.reps} reps @ {allTimeRecord.set.weight} kg
                        <span className="insights-set-num"> (Set {allTimeRecord.setIndex})</span>
                      </span>
                    </div>
                  </div>
                )}

                {/* Previous session best set */}
                {prevSessionBest && (
                  <div className="insights-row">
                    <span className="insights-icon">📅</span>
                    <div className="insights-content">
                      <span className="insights-label">
                        Last session ·{' '}
                        {new Date(prevSessionBest.date).toLocaleDateString('nl-NL', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                      <span className="insights-value">
                        {prevSessionBest.set.reps} reps @ {prevSessionBest.set.weight} kg
                        <span className="insights-set-num"> (Set {prevSessionBest.setIndex})</span>
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Graph toggle */}
              <button
                className="insights-graph-toggle"
                onClick={() => setGraphOpen((v) => !v)}
                aria-expanded={graphOpen}
              >
                <span>{graphOpen ? '▾' : '▸'}</span>
                <span>{graphOpen ? 'Hide graph' : 'Show progress graph'}</span>
              </button>

              {graphOpen && (
                <div className="insights-graph-body">
                  {sessionsAsc.length >= 2 ? (
                    <VolumeGraph sessions={sessionsAsc} />
                  ) : (
                    <p className="insights-graph-hint">
                      Log at least 2 sessions to see your graph.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

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
          {overloadDiff !== null && (
            <div className={`overload-hint ${overloadDiff >= 0 ? 'positive' : 'negative'}`}>
              {overloadDiff >= 0
                ? `▲ +${overloadDiff.toLocaleString()} kg vs last session — progressive overload!`
                : `▼ ${Math.abs(overloadDiff).toLocaleString()} kg vs last session`}
            </div>
          )}

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
