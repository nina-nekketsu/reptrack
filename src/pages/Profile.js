import './Page.css'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { user, signOut, syncing, syncError, isConfigured, syncData } = useAuth();

  async function handleSyncNow() {
    if (user) await syncData(user.id);
  }

  return (
    <div className="page">
      <h2 className="page-heading">Profile</h2>
      <p className="page-sub">Your settings and account</p>

      <div style={{ textAlign: 'center', marginTop: '2rem' }}>
        <div className="profile-avatar">💪</div>
      </div>

      {user && (
        <div className="profile-auth-section">
          <p className="profile-user-email">Signed in as <strong>{user.email}</strong></p>

          <div className="profile-sync-status">
            {syncing && '⟳ Syncing…'}
            {!syncing && syncError && <span className="error">⚠ Last sync failed: {syncError}</span>}
            {!syncing && !syncError && isConfigured && '✓ Cloud sync active'}
          </div>

          {isConfigured && (
            <button
              style={{
                background: 'rgba(124,106,247,0.12)',
                border: '1.5px solid rgba(124,106,247,0.35)',
                color: '#a78bfa',
                borderRadius: 12,
                padding: '0.7rem',
                fontSize: '0.9rem',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              onClick={handleSyncNow}
              disabled={syncing}
            >
              {syncing ? 'Syncing…' : '⟳ Sync now'}
            </button>
          )}

          <button className="profile-signout-btn" onClick={signOut}>
            Sign Out
          </button>
        </div>
      )}

      {!user && !isConfigured && (
        <div className="profile-auth-section">
          <p className="profile-user-email">Running locally — no cloud sync</p>
          <p className="profile-sync-status">
            Add Supabase credentials to <code>.env</code> to enable sync.
          </p>
        </div>
      )}
    </div>
  )
}
