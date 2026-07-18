import { useEffect, useState } from 'react'
import { buildTrainingAnalytics } from '../lib/trainingAnalytics'
import { formatVolume } from './productSurfaceData'
import './Page.css'

function readJson(key, fallback) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null')
    return value ?? fallback
  } catch {
    return fallback
  }
}

function readProgressModel() {
  return buildTrainingAnalytics({
    logs: readJson('exerciseLogs', {}),
    exercises: readJson('exercises', []),
    now: new Date(),
  })
}

export default function Progress() {
  const [model, setModel] = useState(readProgressModel)

  useEffect(() => {
    const refresh = () => setModel(readProgressModel())
    const events = ['storage', 'exerciseLogged']
    events.forEach((eventName) => window.addEventListener(eventName, refresh))
    return () => events.forEach((eventName) => window.removeEventListener(eventName, refresh))
  }, [])

  return (
    <div className="page progress-page">
      <header className="page-header">
        <h2 className="page-heading">Progress</h2>
        <p className="page-sub">Training records and weekly muscle volume from saved workouts.</p>
      </header>

      {model.isEmpty ? (
        <div className="empty-card">
          <strong>No progress data yet</strong>
          <span>Saved strength sessions will appear here.</span>
        </div>
      ) : (
        <>
          {model.e1rmRecords.length > 0 && (
            <section aria-labelledby="progress-prs">
              <div className="section-heading">
                <h2 id="progress-prs">e1RM PRs</h2>
                <span>{model.e1rmRecords.length} {model.e1rmRecords.length === 1 ? 'record' : 'records'}</span>
              </div>
              <div className="today-record-grid">
                {model.e1rmRecords.map((record) => (
                  <div className="today-record-card" key={record.exerciseId}>
                    <span>{record.exerciseName}</span>
                    <strong>{record.e1rm} kg e1RM</strong>
                    <small>{record.weight} kg x {record.reps}</small>
                  </div>
                ))}
              </div>
            </section>
          )}

          {model.muscleGroupWeeklyVolume.length > 0 && (
            <section aria-labelledby="muscle-volume">
              <div className="section-heading">
                <h2 id="muscle-volume">Weekly muscle volume</h2>
                <span>{formatVolume(model.weekly.volume)}</span>
              </div>
              <div className="exercise-list">
                {model.muscleGroupWeeklyVolume.map((record) => (
                  <div className="exercise-card" key={record.muscleGroup}>
                    <span className="exercise-name">{record.muscleGroup}</span>
                    <span className="exercise-meta">{formatVolume(record.volume)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
