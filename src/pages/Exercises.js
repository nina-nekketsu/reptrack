import React, { useState } from 'react';
import './Page.css';
import './Exercises.css';
import ExerciseLogModal from '../components/ExerciseLogModal';
import ExerciseHistoryModal from '../components/ExerciseHistoryModal';
import {
  loadExercises,
  loadLogs,
  saveExercises,
  getSessionsDesc,
  deleteExerciseWithSessions,
} from '../utils/exerciseHelpers';
import { useAuth } from '../context/AuthContext';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

export default function Exercises() {
  const { user } = useAuth();
  const [exercises, setExercises] = useState(loadExercises);
  const [logs, setLogs] = useState(loadLogs);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Chest');
  const [historyFor, setHistoryFor] = useState(null);
  const [deleteExId, setDeleteExId] = useState(null); // exercise pending deletion

  const filtered =
    filter === 'All' ? exercises : exercises.filter((e) => e.muscleGroup === filter);

  function openLog(exercise) {
    setSelected(exercise);
  }

  function closeLog() {
    setSelected(null);
  }

  function handleLogSaved(updatedLogs) {
    setLogs(updatedLogs);
  }

  function handleLogsChanged(updatedLogs) {
    setLogs(updatedLogs);
  }

  function addExercise() {
    if (!newName.trim()) return;
    const next = [
      ...exercises,
      { id: Date.now(), name: newName.trim(), muscleGroup: newGroup, type: 'Strength' },
    ];
    setExercises(next);
    saveExercises(next);
    setNewName('');
    setShowAdd(false);
  }

  function lastSession(exerciseId) {
    const sessions = getSessionsDesc(logs, exerciseId);
    return sessions[0] || null;
  }

  function progressBadge(exerciseId) {
    const sessions = getSessionsDesc(logs, exerciseId);
    if (sessions.length < 2) return null;
    const diff = sessions[0].totalVolume - sessions[1].totalVolume;
    if (diff === 0) return null;
    return { diff, up: diff > 0 };
  }

  function sessionCount(exerciseId) {
    return (logs[exerciseId] || []).length;
  }

  function handleDeleteExerciseClick(e, exerciseId) {
    e.stopPropagation();
    setDeleteExId(exerciseId);
  }

  function handleConfirmDeleteExercise() {
    if (!deleteExId) return;
    const { updatedExercises, updatedLogs } = deleteExerciseWithSessions(deleteExId, user?.id);
    setExercises(updatedExercises);
    setLogs(updatedLogs);
    setDeleteExId(null);
    // Close history modal if it was open for the deleted exercise
    if (historyFor === deleteExId) setHistoryFor(null);
  }

  function handleCancelDeleteExercise() {
    setDeleteExId(null);
  }

  const historyExercise = exercises.find((e) => e.id === historyFor);
  const deleteExercise  = exercises.find((e) => e.id === deleteExId);
  const deleteExSessions = deleteExId ? sessionCount(deleteExId) : 0;

  return (
    <div className="page">
      <h2 className="page-heading">Exercises</h2>
      <p className="page-sub">Tap an exercise to view progress · ＋ to log a session</p>

      {/* Muscle group filter */}
      <div className="filter-row">
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g}
            className={`filter-chip ${filter === g ? 'active' : ''}`}
            onClick={() => setFilter(g)}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="exercise-list">
        {filtered.map((ex) => {
          const last = lastSession(ex.id);
          const badge = progressBadge(ex.id);
          return (
            <div
              className="exercise-card ex-card-row"
              key={ex.id}
              onClick={() => setHistoryFor(ex.id)}
            >
              <div className="ex-info">
                <div className="exercise-name">{ex.name}</div>
                <div className="exercise-meta">{ex.muscleGroup}</div>
                {last && (
                  <div className="ex-last">
                    Last: {last.totalReps} reps · {last.totalVolume.toLocaleString()} kg vol
                    {badge && (
                      <span className={`overload-badge ${badge.up ? 'up' : 'down'}`}>
                        {badge.up ? '▲' : '▼'} {Math.abs(badge.diff).toLocaleString()} kg
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="ex-actions" onClick={(e) => e.stopPropagation()}>
                <button className="icon-btn" onClick={() => openLog(ex)} title="Log session">
                  ＋
                </button>
                <button
                  className="icon-btn icon-btn--danger"
                  onClick={(e) => handleDeleteExerciseClick(e, ex.id)}
                  title="Delete exercise"
                  aria-label="Delete exercise"
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add exercise */}
      {showAdd ? (
        <div className="add-exercise-form">
          <input
            className="ex-input"
            placeholder="Exercise name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addExercise()}
            autoFocus
          />
          <select
            className="ex-select"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
          >
            {MUSCLE_GROUPS.filter((g) => g !== 'All').map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <div className="add-form-actions">
            <button className="btn-primary" style={{ flex: 1 }} onClick={addExercise}>
              Add
            </button>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setShowAdd(true)}>
          + Add Exercise
        </button>
      )}

      {/* Log session modal */}
      {selected && (
        <ExerciseLogModal
          exercise={selected}
          logs={logs}
          onClose={closeLog}
          onSaved={handleLogSaved}
        />
      )}

      {/* Exercise detail / history modal */}
      {historyFor && historyExercise && (
        <ExerciseHistoryModal
          exercise={historyExercise}
          logs={logs}
          onClose={() => setHistoryFor(null)}
          onOpenLog={openLog}
          onLogsChanged={handleLogsChanged}
        />
      )}

      {/* ── Delete exercise confirm modal ── */}
      {deleteExId && deleteExercise && (
        <div className="confirm-overlay" onClick={handleCancelDeleteExercise}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <p className="confirm-message">
              Delete <strong>{deleteExercise.name}</strong>?
            </p>
            {deleteExSessions > 0 ? (
              <p className="confirm-sub">
                This will also delete {deleteExSessions} logged session{deleteExSessions !== 1 ? 's' : ''}. This cannot be undone.
              </p>
            ) : (
              <p className="confirm-sub">This cannot be undone.</p>
            )}
            <div className="confirm-actions">
              <button className="btn-danger" onClick={handleConfirmDeleteExercise}>
                Delete
              </button>
              <button className="btn-secondary" onClick={handleCancelDeleteExercise}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
