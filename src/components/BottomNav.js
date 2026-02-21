import { NavLink } from 'react-router-dom'
import { useEffect, useState } from 'react'
import './BottomNav.css'

const tabs = [
  { to: '/', label: 'Dashboard', icon: '🏠', end: true },
  { to: '/workouts', label: 'Workouts', icon: '🏋️', end: false },
  { to: '/exercises', label: 'Exercises', icon: '📋', end: false },
  { to: '/progress', label: 'Progress', icon: '📈', end: false },
  { to: '/profile', label: 'Profile', icon: '👤', end: false },
]

// Pull today's total volume from localStorage
function getTodayVolume() {
  try {
    const logs = JSON.parse(localStorage.getItem('exerciseLogs') || '{}')
    const today = new Date().toDateString()
    let total = 0
    for (const sessions of Object.values(logs)) {
      for (const session of sessions) {
        if (new Date(session.date).toDateString() === today) {
          total += session.totalVolume || 0
        }
      }
    }
    return total
  } catch {
    return 0
  }
}

function formatVolume(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`
  return `${v}kg`
}

export default function BottomNav() {
  const [todayVolume, setTodayVolume] = useState(getTodayVolume)

  // Re-read on storage changes (cross-tab + after saves in same tab via custom event)
  useEffect(() => {
    function refresh() {
      setTodayVolume(getTodayVolume())
    }
    window.addEventListener('storage', refresh)
    window.addEventListener('exerciseLogged', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('exerciseLogged', refresh)
    }
  }, [])

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
        >
          <span className="nav-icon">{tab.icon}</span>
          <span className="nav-label">{tab.label}</span>

          {/* Volume badge on Exercises tab */}
          {tab.to === '/exercises' && todayVolume > 0 && (
            <span className="nav-badge">{formatVolume(todayVolume)}</span>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
