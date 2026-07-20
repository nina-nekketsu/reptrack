import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { getStoredVisibleActiveWorkoutSession } from '../lib/activeWorkoutSession'
import './BottomNav.css'

const paths = {
  today: 'M3 11.5 12 4l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-5v-6h-5v6h-5A1.5 1.5 0 0 1 3 19.5z',
  workouts: 'M4 9v6m3-8v10m10-10v10m3-8v6M7 12h10M2 10v4m20-4v4',
  coach: 'M9 18h6M10 22h4M8.2 14.6A7 7 0 1 1 15.8 14.6c-.9.7-1.3 1.4-1.3 2.4h-5c0-1-.4-1.7-1.3-2.4z',
  exercises: 'M8 6h11a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2zM9 11h8M9 15h8M9 19h5M3 3h11v3H8a2 2 0 0 0-2 2v8H3z',
  profile: 'M20 21a8 8 0 0 0-16 0M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10z',
}

const tabs = [
  { to: '/today', label: 'Today', icon: 'today', end: true },
  { to: '/workouts', label: 'Workouts', icon: 'workouts', end: false },
  { to: '/coach', label: 'Coach', icon: 'coach', end: false },
  { to: '/exercises', label: 'Exercises', icon: 'exercises', end: false },
  { to: '/profile', label: 'Profile', icon: 'profile', end: false },
]

function NavIcon({ name }) {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d={paths[name]} /></svg>
}

function readStatus() {
  try {
    const logs = JSON.parse(localStorage.getItem('exerciseLogs') || '{}')
    const today = new Date().toDateString()
    let volume = 0
    Object.values(logs).forEach(sessions => sessions.forEach(session => {
      if (new Date(session.date).toDateString() === today) volume += session.totalVolume || 0
    }))
    return { volume, active: Boolean(getStoredVisibleActiveWorkoutSession()) }
  } catch { return { volume: 0, active: false } }
}

const formatVolume = value => value >= 1000 ? `${(value / 1000).toFixed(1)}t` : `${value}kg`

export default function BottomNav() {
  const location = useLocation()
  const [status, setStatus] = useState(readStatus)
  const activeStatusRef = useRef(status.active)
  const [activeCue, setActiveCue] = useState({ sequence: 0, playing: false })

  useEffect(() => {
    const refresh = () => {
      const nextStatus = readStatus()
      const wasActive = activeStatusRef.current
      activeStatusRef.current = nextStatus.active

      if (!wasActive && nextStatus.active) {
        setActiveCue(cue => ({ sequence: cue.sequence + 1, playing: true }))
      } else if (!nextStatus.active) {
        setActiveCue(cue => cue.playing ? { ...cue, playing: false } : cue)
      }

      setStatus(nextStatus)
    }
    window.addEventListener('storage', refresh)
    window.addEventListener('exerciseLogged', refresh)
    window.addEventListener('activeWorkoutSessionChanged', refresh)
    return () => ['storage', 'exerciseLogged', 'activeWorkoutSessionChanged'].forEach(type => window.removeEventListener(type, refresh))
  }, [])

  useEffect(() => {
    if (!activeCue.playing) return undefined
    const sequence = activeCue.sequence
    const timeout = window.setTimeout(() => {
      setActiveCue(cue => cue.sequence === sequence ? { ...cue, playing: false } : cue)
    }, 700)
    return () => window.clearTimeout(timeout)
  }, [activeCue.playing, activeCue.sequence])

  if (/^\/workout\/[^/]+$/.test(location.pathname)) return null

  return <nav className="bottom-nav" aria-label="Main">
    {tabs.map(tab => {
      const ariaLabel = tab.to === '/exercises' && status.volume
        ? `Exercises, ${formatVolume(status.volume)} logged today`
        : tab.to === '/workouts' && status.active
          ? 'Workouts, workout active'
          : tab.label

      return <NavLink key={tab.to} to={tab.to} end={tab.end}
        aria-label={ariaLabel}
        className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}>
        <span className="nav-indicator" aria-hidden="true" />
        <span className="nav-icon"><NavIcon name={tab.icon} /></span>
        <span className="nav-label">{tab.label}</span>
        {tab.to === '/workouts' && status.active && <span
          key={activeCue.sequence}
          className={`nav-active-dot ${activeCue.playing ? 'nav-active-dot--new' : ''}`}
          aria-hidden="true"
        />}
        {tab.to === '/exercises' && status.volume > 0 && <span className="nav-badge">{formatVolume(status.volume)}</span>}
      </NavLink>
    })}
  </nav>
}
