import './Page.css'

export default function Profile() {
  return (
    <div className="page">
      <h2 className="page-heading">Profile</h2>
      <p className="page-sub">Your settings and personal info</p>
      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <div className="profile-avatar">💪</div>
        <p className="page-sub">Profile setup coming soon.</p>
      </div>
    </div>
  )
}
