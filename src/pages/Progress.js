import './Page.css'

export default function Progress() {
  return (
    <div className="page">
      <h2 className="page-heading">Progress</h2>
      <p className="page-sub">Track your gains over time</p>
      <p className="page-sub" style={{ textAlign: 'center', marginTop: '2rem' }}>
        Charts will appear once you have logged workouts.
      </p>
    </div>
  )
}
