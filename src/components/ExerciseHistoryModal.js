import React, { useState } from 'react';
import RecordBadges from './RecordBadges';
import VolumeGraph from './VolumeGraph';
import {
  getRecords,
  getSessionsAsc,
  getSessionsDesc,
  deleteSession,
} from '../utils/exerciseHelpers';
import { useAuth } from '../context/AuthContext';

/**
 * Full exercise history/detail modal.
 *
 * Props:
 *   exercise      — { id, name, muscleGroup, ... }
 *   logs          — current logs object
 *   onClose       — callback when modal is dismissed
 *   onOpenLog     — callback to open the log modal for this exercise
 *   onLogsChanged — callback(updatedLogs) after a session is deleted
 */
export default function ExerciseHistoryModal({ exercise, logs, onClose, onOpenLog, onLogsChanged }) {
  const { user } = useAuth();
  const [confirmDate, setConfirmDate] = useState(null); // date of session pending deletion

  const sessionsDesc = getSessionsDesc(logs, exercise.id);
  const sessionsAsc  = getSessionsAsc(logs, exercise.id);
  const records      = getRecords(sessionsDesc);

  function handleDeleteClick(e, sessionDate) {
    e.stopPropagation();
    setConfirmDate(sessionDate);
  }

  function handleConfirmDelete() {
    const updated = deleteSession(exercise.id, confirmDate, user?.id);
    setConfirmDate(null);
    if (onLogsChanged) onLogsChanged(updated);
  }

  function handleCancelDelete() {
    setConfirmDate(null);
  }

  // Re-derive after potential deletion
  const displaySessions = getSessionsDesc(logs, exercise.id);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--tall" onClick={(e) => e.stopPropagation()}>
        <div className="detail-header">
          <div>
            <h3 className="modal-title">{exercise.name}</h3>
            <p className="modal-sub">
              {exercise.muscleGroup} · {displaySessions.length} session{displaySessions.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            className="btn-primary btn--sm"
            onClick={() => { onClose(); if (onOpenLog) onOpenLog(exercise); }}
          >
            ＋ Log
          </button>
        </div>

        {displaySessions.length === 0 ? (
          <div className="empty-state">
            No sessions yet. Hit ＋ Log to record your first one!
          </div>
        ) : (
          <>
            <div className="section-label">Personal Records</div>
            <RecordBadges records={records} />

            <div className="section-label">Volume Over Time</div>
            <VolumeGraph sessions={sessionsAsc} />

            <div className="section-label">Session History</div>
            <div className="history-sessions">
              {displaySessions.map((session, i) => {
                const prev = displaySessions[i + 1];
                const diff = prev ? session.totalVolume - prev.totalVolume : null;
                return (
                  <div className="session-card" key={session.date}>
                    <div className="session-card-header">
                      <div className="session-date">
                        {new Date(session.date).toLocaleDateString('nl-NL', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                      <button
                        className="session-delete-btn"
                        onClick={(e) => handleDeleteClick(e, session.date)}
                        title="Delete this session"
                        aria-label="Delete session"
                      >
                        🗑
                      </button>
                    </div>
                    <div className="session-stats">
                      <span>{session.sets.length} sets</span>
                      <span>{session.totalReps} reps</span>
                      <span>{session.totalVolume.toLocaleString()} kg vol</span>
                      {diff !== null && (
                        <span className={`overload-badge ${diff >= 0 ? 'up' : 'down'}`}>
                          {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toLocaleString()} kg
                        </span>
                      )}
                    </div>
                    {session.bestSet && (
                      <div className="session-best">
                        Best set: <strong>{session.bestSet.reps} reps @ {session.bestSet.weight} kg</strong>
                      </div>
                    )}
                    <div className="session-sets-detail">
                      {session.sets.map((s, j) => (
                        <span key={j} className="set-pill">
                          {s.reps}×{s.weight}kg
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <button className="btn-secondary" onClick={onClose}>
          Close
        </button>
      </div>

      {/* ── Delete confirm modal ── */}
      {confirmDate && (
        <div className="confirm-overlay" onClick={handleCancelDelete}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">🗑️</div>
            <p className="confirm-message">Delete this session? This cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={handleConfirmDelete}>
                Delete
              </button>
              <button className="btn-secondary" onClick={handleCancelDelete}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
