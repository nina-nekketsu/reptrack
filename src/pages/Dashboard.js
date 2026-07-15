import { getStoredVisibleActiveWorkoutSession } from '../lib/activeWorkoutSession'
import './Page.css'

function readTodayData() {
  let logs = {}
  try { logs = JSON.parse(localStorage.getItem('exerciseLogs') || '{}') } catch {}
  const now = new Date()
  const weekStart = new Date(now)
  weekStart.setHours(0, 0, 0, 0)
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7))
  const sessions = Object.values(logs).flat().filter(Boolean)
  const thisWeek = sessions.filter(s => new Date(s.date) >= weekStart)
  const volume = thisWeek.reduce((sum, s) => sum + Number(s.totalVolume || 0), 0)
  const trainingDays = new Set(thisWeek.map(s => new Date(s.date).toDateString())).size
  const latest = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date))[0]
  return { sessions: thisWeek.length, volume, trainingDays, latest, active: getStoredVisibleActiveWorkoutSession() }
}

const formatVolume = value => value >= 1000 ? `${(value / 1000).toFixed(1)}t` : `${Math.round(value)}kg`
const formatDate = value => value ? new Intl.DateTimeFormat('en', { weekday:'short', day:'numeric', month:'short' }).format(new Date(value)) : ''

export default function Dashboard() {
  const data = readTodayData()
  const day = new Intl.DateTimeFormat('en', { weekday:'long', day:'numeric', month:'long' }).format(new Date())
  return <div className="page today-page">
    <header className="page-header"><span className="page-overline">{day}</span><h1 className="page-heading">Today</h1><p className="page-sub">Your training, at a glance.</p></header>
    {data.active && <a className="today-resume" href={`#/workout/${data.active.planId}`}>
      <span className="today-resume__signal" aria-hidden="true" />
      <span><small>Active workout</small><strong>{data.active.planName}</strong><span>Resume session</span></span>
      <span className="today-resume__arrow" aria-hidden="true">›</span>
    </a>}
    <section aria-labelledby="week-summary"><div className="section-heading"><h2 id="week-summary">This week</h2><span>{data.trainingDays} training {data.trainingDays === 1 ? 'day' : 'days'}</span></div>
      <div className="stats-grid">
        <div className="stat-card"><span className="stat-label">Sessions</span><span className="stat-value">{data.sessions}</span></div>
        <div className="stat-card stat-card--accent"><span className="stat-label">Volume</span><span className="stat-value">{formatVolume(data.volume)}</span></div>
      </div>
    </section>
    <section className="today-latest"><div className="section-heading"><h2>Latest session</h2>{data.latest && <span>{formatDate(data.latest.date)}</span>}</div>
      {data.latest ? <div className="today-session-card"><div><span className="stat-label">Completed work</span><strong>{data.latest.totalReps || 0} reps</strong></div><div><span className="stat-label">Volume</span><strong>{formatVolume(data.latest.totalVolume || 0)}</strong></div></div>
      : <div className="empty-card"><strong>No sessions yet</strong><span>Your first workout will show up here.</span><a href="#/workouts">Choose a workout</a></div>}
    </section>
  </div>
}
