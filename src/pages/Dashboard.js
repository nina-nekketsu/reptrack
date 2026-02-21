import './Page.css'

export default function Dashboard() {
  return (
    <div className="page">
      <h2 className="page-heading">Dashboard</h2>
      <p className="page-sub">Overview of your training progress</p>
      <div className="stats-grid">
        <div className="stat-card">
          <span className="stat-value">—</span>
          <span className="stat-label">Workouts This Week</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">—</span>
          <span className="stat-label">Current Streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">—</span>
          <span className="stat-label">Total Volume</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">—</span>
          <span className="stat-label">Avg Session Time</span>
        </div>
      </div>
    </div>
  )
}
