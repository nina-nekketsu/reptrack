import React, { useEffect, useRef, useState } from 'react';
import SetTimer from './SetTimer';
import RecordBadges from './RecordBadges';
import VolumeGraph from './VolumeGraph';
import { formatBuildId } from '../utils/buildInfo';
import {
  calcTotals,
  bestSet,
  getRecords,
  getSessionsAsc,
  getSessionsDesc,
  loadLogs,
  saveLogs,
  upsertSession,
} from '../utils/exerciseHelpers';
import { useAuth } from '../context/AuthContext';

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
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('log'); // 'log' | 'overview'
  const [sets, setSets] = useState([{ reps: '', weight: '' }]);
  const logScrollRef = useRef(null);

  // Always start at the top when opening a new exercise
  useEffect(() => {
    logScrollRef.current?.scrollTo({ top: 0 });
    setActiveTab('log');
    setSets([{ reps: '', weight: '' }]);
  }, [exercise?.id]);

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

  function scrollToTop() {
    logScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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

    // Sync to Supabase (fire-and-forget)
    if (user) {
      upsertSession(exercise.id, session, user.id).catch((err) =>
        console.warn('[Supabase] session sync failed:', err)
      );
    }

    window.dispatchEvent(new Event('exerciseLogged'));

    if (onSaved) onSaved(updated);
    onClose();
  }

  // ── Derived data for Overview tab ──
  const sessionsDesc = getSessionsDesc(logs, exercise.id);
  const sessionsAsc = getSessionsAsc(logs, exercise.id);
  const hasHistory = sessionsDesc.length > 0;
  const records = getRecords(sessionsDesc);
  const liveTotals = calcTotals(sets);

  const lastSession = sessionsDesc[0] || null;
  const last5 = sessionsDesc.slice(0, 5);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--log" onClick={(e) => e.stopPropagation()}>
        {/* Sticky timer zone */}
        <div id="log-timer-top" className="log-timer-zone">
          <div className="log-header-text">
            <div className="log-header-title-row">
              <h3 className="modal-title">{exercise.name}</h3>
              <span className="build-id-tag build-id-tag--modal">{formatBuildId()}</span>
            </div>
            <p className="modal-sub">{exercise.muscleGroup} · Log your sets</p>
          </div>

          <SetTimer exerciseId={exercise.id} onClose={onClose} />

          {/* Alpha-style tabs (always visible) */}
          <div className="log-tabs" role="tablist" aria-label="Exercise tabs">
            <button
              type="button"
              className={`log-tab ${activeTab === 'log' ? 'active' : ''}`}
              onClick={() => setActiveTab('log')}
              role="tab"
              aria-selected={activeTab === 'log'}
            >
              Log
            </button>
            <button
              type="button"
              className={`log-tab ${activeTab === 'overview' ? 'active' : ''}`}
              onClick={() => setActiveTab('overview')}
              role="tab"
              aria-selected={activeTab === 'overview'}
            >
              Overview
            </button>
          </div>
        </div>

        {/* Scrollable body (content under tabs) */}
        <div className="log-scroll-body" ref={logScrollRef}>
          {activeTab === 'log' ? (
            <>
              <div className="modal-divider" />

              <div className="sets-header">
                <span>Set</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                <span></span>
              </div>

              {sets.map((s, i) => (
                <div className="set-row" key={i}>
                  <span className="set-num">{i + 1}</span>
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
              ))}

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
            </>
          ) : (
            <>
              <div className="modal-divider" />

              {!hasHistory ? (
                <p className="insights-no-history">
                  📭 No history yet on this device/site — log a session to see your records and graph.
                </p>
              ) : (
                <>
                  <div className="section-label">Personal Records</div>
                  <RecordBadges records={records} />

                  <div className="section-label">Volume Over Time</div>
                  {sessionsAsc.length >= 2 ? (
                    <VolumeGraph sessions={sessionsAsc} />
                  ) : (
                    <p className="insights-graph-hint">Log at least 2 sessions to see your graph.</p>
                  )}

                  {lastSession && (
                    <>
                      <div className="section-label">Last Session Sets</div>
                      <div className="last-session-sets">
                        <div className="last-session-sets__header">
                          <span className="last-session-sets__title">📋 Last session</span>
                          <span className="last-session-sets__date">
                            {new Date(lastSession.date).toLocaleDateString('nl-NL', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                            })}
                          </span>
                        </div>
                        <table className="last-session-sets__table">
                          <thead>
                            <tr>
                              <th>Set</th>
                              <th>kg</th>
                              <th>Reps</th>
                            </tr>
                          </thead>
                          <tbody>
                            {lastSession.sets.map((s, idx) => (
                              <tr key={idx}>
                                <td>{idx + 1}</td>
                                <td>{s.weight || '—'}</td>
                                <td>{s.reps || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <div className="section-label">Recent Sessions</div>
                  <div className="history-sessions">
                    {last5.map((session) => (
                      <div className="session-card" key={session.date}>
                        <div className="session-date">
                          {new Date(session.date).toLocaleDateString('nl-NL', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="session-stats">
                          <span>{session.sets.length} sets</span>
                          <span>{session.totalReps} reps</span>
                          <span>{session.totalVolume.toLocaleString()} kg vol</span>
                        </div>
                        <div className="session-sets-detail">
                          {session.sets.map((s, j) => (
                            <span key={j} className="set-pill">
                              {s.reps}×{s.weight}kg
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <button className="btn-secondary" onClick={scrollToTop} type="button">
                Back to top
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
