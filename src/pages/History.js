import React, { useEffect, useMemo, useState } from 'react';
import ExerciseLogModal from '../components/ExerciseLogModal';
import { buildHistoryModel, formatVolume } from './productSurfaceData';
import './Page.css';

function readJson(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

function formatDay(value) {
  return new Intl.DateTimeFormat(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export default function History() {
  const [logs, setLogs] = useState(() => readJson('exerciseLogs', {}));
  const [exercises, setExercises] = useState(() => readJson('exercises', []));
  const [limit, setLimit] = useState(50);
  const [selectedDayKey, setSelectedDayKey] = useState(null);
  const [editingExercise, setEditingExercise] = useState(null);

  useEffect(() => {
    const refresh = () => {
      setLogs(readJson('exerciseLogs', {}));
      setExercises(readJson('exercises', []));
    };
    window.addEventListener('storage', refresh);
    window.addEventListener('exerciseLogged', refresh);
    return () => {
      window.removeEventListener('storage', refresh);
      window.removeEventListener('exerciseLogged', refresh);
    };
  }, []);

  const model = useMemo(() => buildHistoryModel({ logs, exercises, limit }), [logs, exercises, limit]);
  const selectedDay = model.days.find((day) => day.key === selectedDayKey) || null;

  function openExerciseHistory(exerciseId) {
    const exercise = exercises.find((candidate) => String(candidate.id) === String(exerciseId));
    if (exercise) setEditingExercise(exercise);
  }

  return (
    <div className="page history-page">
      <header className="page-header">
        <span className="page-overline">Saved locally</span>
        <h1 className="page-heading">History</h1>
        <p className="page-sub">Grouped from your real exercise logs.</p>
      </header>

      {model.isEmpty ? (
        <div className="empty-card">
          <strong>No workout history yet</strong>
          <span>Save an exercise session and it will appear here.</span>
          <a href="#/workouts">Start a workout</a>
        </div>
      ) : (
        <div className="history-days">
          {model.days.map((day) => (
            <button className="history-day-card" type="button" key={day.key} onClick={() => setSelectedDayKey(day.key)}>
              <span className="history-day-card__date">{formatDay(day.date)}</span>
              <span className="history-day-card__metrics">
                <strong>{day.sessions.length}</strong> {day.sessions.length === 1 ? 'exercise session' : 'exercise sessions'}
                <span aria-hidden="true">·</span>
                <strong>{day.setCount}</strong> sets
                <span aria-hidden="true">·</span>
                <strong>{formatVolume(day.volume)}</strong>
              </span>
              <span className="history-day-card__names">{day.sessions.map((session) => session.exerciseName).join(' · ')}</span>
            </button>
          ))}
        </div>
      )}

      {model.hasMore && (
        <button className="btn-secondary history-load-more" type="button" onClick={() => setLimit((current) => current + 50)}>
          Load more ({model.totalSessions - model.renderedSessions} remaining)
        </button>
      )}

      {selectedDay && !editingExercise && (
        <div className="history-detail-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelectedDayKey(null)}>
          <section className="history-detail" role="dialog" aria-modal="true" aria-labelledby="history-detail-title">
            <header>
              <div>
                <span className="page-overline">Day detail</span>
                <h2 id="history-detail-title">{formatDay(selectedDay.date)}</h2>
              </div>
              <button type="button" className="history-detail__close" aria-label="Close day detail" onClick={() => setSelectedDayKey(null)}>×</button>
            </header>
            <div className="history-detail__summary">
              <span>{selectedDay.setCount} sets</span>
              <span>{formatVolume(selectedDay.volume)} volume</span>
            </div>
            <div className="history-detail__sessions">
              {selectedDay.sessions.map((session) => (
                <article className="history-session" key={session.sessionKey}>
                  <div>
                    <span>{formatTime(session.date)}</span>
                    <strong>{session.exerciseName}</strong>
                    <small>{session.setCount} sets · {session.totalReps} reps · {formatVolume(session.totalVolume)}</small>
                  </div>
                  <button type="button" onClick={() => openExerciseHistory(session.exerciseId)}>
                    Edit or delete
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {editingExercise && (
        <ExerciseLogModal
          exercise={editingExercise}
          logs={logs}
          initialTab="overview"
          onClose={() => setEditingExercise(null)}
          onSaved={(nextLogs) => {
            setLogs(nextLogs);
            setEditingExercise(null);
          }}
        />
      )}
    </div>
  );
}
