import './Page.css'
import { useAuth } from '../context/AuthContext'
import { useEffect, useState, useCallback } from 'react'
import { formatBuildId } from '../utils/buildInfo'
import {
  getCoachShare,
  enableCoachShare,
  disableCoachShare,
  rotateCoachToken,
} from '../lib/coachShare'
import { isConfigured } from '../lib/supabase'
import { loadGlobalRestDefault, saveGlobalRestDefault } from '../utils/timer'

const BASE_URL = 'https://nina-nekketsu.github.io/reptrack/#/coach/';

function buildCoachLink(token) {
  return `${BASE_URL}${token}`;
}

export default function Profile() {
  const { user, signOut, syncing, syncError, syncData } = useAuth();

  // ── Coach share state ──────────────────────────────────────────────────
  const [shareRecord, setShareRecord]   = useState(null); // coach_shares row
  const [shareLoading, setShareLoading] = useState(false);
  const [shareError, setShareError]     = useState(null);
  const [copied, setCopied]             = useState(false);
  const [globalRest, setGlobalRest]     = useState(() => loadGlobalRestDefault());

  const loadShare = useCallback(async () => {
    if (!user || !isConfigured) return;
    try {
      const rec = await getCoachShare(user.id);
      setShareRecord(rec);
    } catch (err) {
      console.error('[Profile] loadShare error:', err);
    }
  }, [user]);

  useEffect(() => { loadShare(); }, [loadShare]);

  async function handleSyncNow() {
    if (user) await syncData(user.id);
  }

  function handleGlobalRestChange(val) {
    const n = Math.max(5, Math.min(600, Number(val) || 90));
    setGlobalRest(n);
    saveGlobalRestDefault(n);
  }

  async function handleToggleShare(enabled) {
    if (!user) return;
    setShareLoading(true);
    setShareError(null);
    try {
      let rec;
      if (enabled) {
        rec = await enableCoachShare(user.id);
      } else {
        rec = await disableCoachShare(user.id);
      }
      setShareRecord(rec);
    } catch (err) {
      console.error('[Profile] toggle share error:', err);
      setShareError(err.message || 'Something went wrong');
    } finally {
      setShareLoading(false);
    }
  }

  async function handleRotate() {
    if (!user) return;
    if (!window.confirm('Rotating the token will invalidate the current link. Continue?')) return;
    setShareLoading(true);
    setShareError(null);
    try {
      const rec = await rotateCoachToken(user.id);
      setShareRecord(rec);
    } catch (err) {
      console.error('[Profile] rotate error:', err);
      setShareError(err.message || 'Something went wrong');
    } finally {
      setShareLoading(false);
    }
  }

  function handleCopy() {
    if (!shareRecord?.token) return;
    const link = buildCoachLink(shareRecord.token);
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const shareEnabled = shareRecord?.enabled === true;
  const coachLink = shareRecord?.token ? buildCoachLink(shareRecord.token) : null;

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

          {/* ── Coach sharing ─────────────────────────────────────────── */}
          {isConfigured && (
            <div className="coach-share-section">
              <h3 className="coach-share-heading">🔗 Coach sharing</h3>
              <p className="coach-share-desc">
                Generate a private link so your coach can view your logs — no account needed on their end.
              </p>

              {shareError && (
                <div className="coach-share-error">⚠ {shareError}</div>
              )}

              {/* Toggle */}
              <div className="coach-share-toggle-row">
                <span className="coach-share-label">
                  {shareEnabled ? 'Sharing ON' : 'Sharing OFF'}
                </span>
                <button
                  className={`coach-toggle-btn ${shareEnabled ? 'active' : ''}`}
                  onClick={() => handleToggleShare(!shareEnabled)}
                  disabled={shareLoading}
                  aria-pressed={shareEnabled}
                >
                  {shareLoading ? '…' : shareEnabled ? 'ON' : 'OFF'}
                </button>
              </div>

              {/* Link block — only when enabled and token exists */}
              {shareEnabled && coachLink && (
                <div className="coach-link-block">
                  {/* Warning */}
                  <div className="coach-share-warning">
                    ⚠ Anyone with this link can view your training logs.
                  </div>

                  <label className="coach-link-label">Coach link</label>
                  <div className="coach-link-row">
                    <input
                      className="coach-link-input"
                      readOnly
                      value={coachLink}
                      onFocus={(e) => e.target.select()}
                    />
                    <button
                      className="coach-copy-btn"
                      onClick={handleCopy}
                      disabled={shareLoading}
                    >
                      {copied ? '✓ Copied' : 'Copy'}
                    </button>
                  </div>

                  <button
                    className="coach-rotate-btn"
                    onClick={handleRotate}
                    disabled={shareLoading}
                  >
                    🔄 Rotate link (revokes old link)
                  </button>
                </div>
              )}
            </div>
          )}
          {/* ── /Coach sharing ──────────────────────────────────────────── */}

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
      <div className="profile-build-footer">
        <span className="build-id-tag">{formatBuildId()}</span>
      </div>
    </div>
  )
}
