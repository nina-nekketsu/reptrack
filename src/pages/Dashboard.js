import { useEffect, useState } from 'react'
import { getStoredVisibleActiveWorkoutSession } from '../lib/activeWorkoutSession'
import { buildTodayModel, formatVolume } from './productSurfaceData'
import './Page.css'

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return value ?? fallback
  } catch {
    return fallback
  }
}

function readTodayModel() {
  return buildTodayModel({
    logs: readJson('exerciseLogs', {}),
    exercises: readJson('exercises', []),
    activeSession: getStoredVisibleActiveWorkoutSession(),
    now: new Date(),
  })
}

function formatDate(value, options = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return value ? new Intl.DateTimeFormat(undefined, options).format(new Date(value)) : ''
}

function MetricCard({ label, value, accent = false }) {
  return (
    <div className={accent ? 'stat-card stat-card--accent' : 'stat-card'}>
      <span className="stat-label">{label}</span>
      <span className="stat-value">{value}</span>
    </div>
  )
}

export default function Dashboard() {
  const [model, setModel] = useState(readTodayModel)

  useEffect(() => {
    const refresh = () => setModel(readTodayModel())
    const events = ['storage', 'exerciseLogged', 'activeWorkoutSessionChanged']
    events.forEach((eventName) => window.addEventListener(eventName, refresh))
    return () => events.forEach((eventName) => window.removeEventListener(eventName, refresh))
  }, [])

  const day = formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="page today-page">
      <header className="page-header">
        <span className="page-overline">{day}</span>
        <h1 className="page-heading">Today</h1>
        <p className="page-sub">Real training data from this device.</p>
      </header>

      {model.activeSession && (
        <a className="today-resume" href={`#/workout/${model.activeSession.planId}`}>
          <span className="today-resume__signal" aria-hidden="true" />
          <span>
            <small>Active workout</small>
            <strong>{model.activeSession.planName || 'Workout in progress'}</strong>
            <span>Resume session</span>
          </span>
          <span className="today-resume__arrow" aria-hidden="true">›</span>
        </a>
      )}

      <section aria-labelledby="week-summary">
        <div className="section-heading">
          <h2 id="week-summary">This week</h2>
          <span>{model.week.trainingDays} training {model.week.trainingDays === 1 ? 'day' : 'days'}</span>
        </div>
        <div className="stats-grid today-stats-grid">
          <MetricCard label="Sessions" value={model.week.sessionCount} />
          <MetricCard label="Sets" value={model.week.setCount} />
          <MetricCard label="Volume" value={formatVolume(model.week.volume)} accent />
        </div>
      </section>

      <section className="today-latest" aria-labelledby="latest-session">
        <div className="section-heading">
          <h2 id="latest-session">Latest session</h2>
          {model.lastWorkout && <span>{formatDate(model.lastWorkout.date)}</span>}
        </div>
        {model.lastWorkout ? (
          <div className="today-session-card">
            <div>
              <span className="stat-label">Exercise</span>
              <strong>{model.lastWorkout.exerciseName}</strong>
            </div>
            <div>
              <span className="stat-label">Work</span>
              <strong>{model.lastWorkout.totalReps} reps · {formatVolume(model.lastWorkout.totalVolume)}</strong>
            </div>
          </div>
        ) : (
          <div className="empty-card">
            <strong>No sessions yet</strong>
            <span>Your first saved exercise session will appear here.</span>
            <a href="#/workouts">Choose a workout</a>
          </div>
        )}
      </section>

      {model.strengthPrs.length > 0 && (
        <section className="today-records" aria-labelledby="strength-bests">
          <div className="section-heading"><h2 id="strength-bests">Strength bests</h2><span>From saved sets</span></div>
          <div className="today-record-grid">
            {model.strengthPrs.map((record) => (
              <div className="today-record-card" key={record.exerciseId}>
                <span>{record.exerciseName}</span>
                <strong>{record.value}</strong>
                <small>{record.label}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {model.cardioSessions.length > 0 && (
        <section className="today-cardio" aria-labelledby="recent-cardio">
          <div className="section-heading"><h2 id="recent-cardio">Recent cardio</h2></div>
          <div className="today-cardio-list">
            {model.cardioSessions.map((session) => (
              <div className="today-cardio-row" key={`${session.exerciseId}:${session.date}`}>
                <span><strong>{session.exerciseName}</strong><small>{formatDate(session.date)}</small></span>
                <strong>{session.value}</strong>
              </div>
            ))}
          </div>
        </section>
      )}

      {model.isEmpty && (
        <p className="today-honesty-note">Streaks and goals stay hidden until RepTrack has enough real data to calculate them.</p>
      )}
    </div>
  )
}
