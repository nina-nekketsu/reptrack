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
import {
  loadGlobalRestDefault,
  saveGlobalRestDefault,
  loadSoundEnabled,
  saveSoundEnabled,
  loadHapticsEnabled,
  saveHapticsEnabled,
} from '../utils/timer'
import { applyDataImport, createDataExport, previewDataImport } from '../utils/dataTransfer'
import DiagnosticsPanel from '../components/DiagnosticsPanel'
import Dialog from '../components/ui/Dialog'
import { CheckIcon, DumbbellIcon, LinkIcon, RepeatIcon, TimerIcon, WarningIcon } from '../components/icons'

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
  const [soundEnabled, setSoundEnabled] = useState(() => loadSoundEnabled());
  const [hapticsEnabled, setHapticsEnabled] = useState(() => loadHapticsEnabled());
  const [importSnapshot, setImportSnapshot] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [transferMessage, setTransferMessage] = useState('');
  const [transferError, setTransferError] = useState('');
  const [rotateConfirmOpen, setRotateConfirmOpen] = useState(false);

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

  function handleExportData() {
    const snapshot = createDataExport();
    const blob = new Blob([`${JSON.stringify(snapshot, null, 2)}\n`], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `reptrack-export-${snapshot.exportedAt.slice(0, 10)}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setTransferError('');
    setTransferMessage('Export ready');
  }

  async function handleImportFile(event) {
    const file = event.target.files?.[0];
    setImportSnapshot(null);
    setImportPreview(null);
    setTransferMessage('');
    setTransferError('');
    if (!file) return;
    if (file.size && file.size > 5 * 1024 * 1024) {
      setTransferError('That export is larger than 5 MB. Choose a smaller RepTrack export.');
      return;
    }
    try {
      const snapshot = JSON.parse(await file.text());
      const preview = previewDataImport(snapshot);
      if (!preview.valid) throw new Error(preview.error);
      setImportSnapshot(snapshot);
      setImportPreview(preview);
    } catch (error) {
      setTransferError(error.message || 'This file is not a valid RepTrack export.');
    }
  }

  function handleApplyImport() {
    if (!importSnapshot) return;
    try {
      applyDataImport(importSnapshot);
      setTransferError('');
      setTransferMessage('Import complete. Existing records were kept.');
      setImportSnapshot(null);
      setImportPreview(null);
    } catch (error) {
      setTransferError(error.message || 'Import failed. No data was changed.');
    }
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
    setRotateConfirmOpen(false);
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

      <div className="profile-avatar-wrap">
        <div className="profile-avatar" aria-hidden="true"><DumbbellIcon /></div>
      </div>

      {/* Timer Defaults */}
      <div className="profile-auth-section">
        <h3><TimerIcon /> Timer Defaults</h3>
        <div className="profile-rest-setting">
          <label className="profile-rest-label" htmlFor="global-rest">
            Default rest duration (seconds)
          </label>
          <div className="profile-rest-controls">
            {[30, 60, 90, 120].map((sec) => (
              <button
                key={sec}
                className={`profile-rest-btn ${globalRest === sec ? 'profile-rest-btn--active' : ''}`}
                onClick={() => handleGlobalRestChange(sec)}
              >
                {sec}s
              </button>
            ))}
            <input
              id="global-rest"
              className="profile-rest-input"
              type="number"
              min="5"
              max="600"
              step="5"
              value={globalRest}
              onChange={(e) => handleGlobalRestChange(e.target.value)}
            />
          </div>
          <p className="profile-rest-hint">
            Used for all exercises unless you set a custom rest time per exercise.
          </p>
          <div className="profile-feedback-toggles">
            <label className="profile-feedback-toggle">
              <span><strong>Timer sounds</strong><small>Play the rest-complete alert</small></span>
              <input type="checkbox" checked={soundEnabled} onChange={(event) => { const value = event.target.checked; setSoundEnabled(value); saveSoundEnabled(value); }} />
            </label>
            <label className="profile-feedback-toggle">
              <span><strong>Haptics</strong><small>Vibrate for timer and PR feedback when supported</small></span>
              <input type="checkbox" checked={hapticsEnabled} onChange={(event) => { const value = event.target.checked; setHapticsEnabled(value); saveHapticsEnabled(value); }} />
            </label>
          </div>
        </div>
      </div>

      {user && (
        <div className="profile-auth-section">
          <p className="profile-user-email">Signed in as <strong>{user.email}</strong></p>

          <div className="profile-sync-status">
            {syncing && <><RepeatIcon /> Syncing...</>}
            {!syncing && syncError && <span className="error"><WarningIcon /> Last sync failed: {syncError}</span>}
            {!syncing && !syncError && isConfigured && <><CheckIcon /> Cloud sync active</>}
          </div>

          {isConfigured && (
            <button
              className="profile-sync-now-btn"
              onClick={handleSyncNow}
              disabled={syncing}
            >
              {syncing ? 'Syncing...' : <><RepeatIcon /> Sync now</>}
            </button>
          )}

          {/* ── Coach sharing ─────────────────────────────────────────── */}
          {isConfigured && (
            <div className="coach-share-section">
              <h3 className="coach-share-heading"><LinkIcon /> Coach sharing</h3>
              <p className="coach-share-desc">
                Generate a private link so your coach can view your logs — no account needed on their end.
              </p>

              {shareError && (
                <div className="coach-share-error"><WarningIcon /> {shareError}</div>
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
                    <WarningIcon /> Anyone with this link can view your training logs.
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
                      {copied ? <><CheckIcon /> Copied</> : 'Copy'}
                    </button>
                  </div>

                  <button
                    className="coach-rotate-btn"
                    onClick={() => setRotateConfirmOpen(true)}
                    disabled={shareLoading}
                  >
                    <RepeatIcon /> Rotate link (revokes old link)
                  </button>
                </div>
              )}
              <Dialog
                open={rotateConfirmOpen}
                onClose={() => setRotateConfirmOpen(false)}
                title="Rotate coach link"
                description="Rotating the token will invalidate the current link immediately."
                panelClassName="profile-confirm-dialog"
              >
                <div className="profile-confirm-actions">
                  <button
                    type="button"
                    className="btn-secondary"
                    onClick={() => setRotateConfirmOpen(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="btn-danger"
                    onClick={handleRotate}
                    disabled={shareLoading}
                  >
                    Rotate link
                  </button>
                </div>
              </Dialog>
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

      <section className="profile-auth-section profile-data-section" aria-labelledby="data-privacy-title">
        <h3 id="data-privacy-title">Data & privacy</h3>
        <p className="profile-rest-hint">
          Training data is stored on this device first. If cloud sync is configured and you sign in,
          supported records are also copied to your private Supabase account.
        </p>
        <div className="profile-data-actions">
          <button type="button" className="btn-secondary" onClick={handleExportData}>
            Export data
          </button>
          <label className="btn-secondary profile-import-label" htmlFor="reptrack-import">
            Choose import file
          </label>
          <input
            id="reptrack-import"
            className="profile-import-input"
            type="file"
            accept="application/json,.json"
            aria-label="Choose RepTrack export"
            onChange={handleImportFile}
          />
        </div>
        <p className="profile-rest-hint">
          Import is additive: existing exercises, plans, sessions, and settings are kept. Review the preview before applying.
        </p>
        {importPreview && (
          <div className="profile-import-preview" role="region" aria-label="Import preview">
            <strong>Import preview</strong>
            <p>{importPreview.summary.exercises.add} exercise will be added; {importPreview.summary.exercises.keep} kept.</p>
            <p>{importPreview.summary.workoutPlans.add} plan will be added; {importPreview.summary.workoutPlans.keep} kept.</p>
            <p>{importPreview.summary.sessions.add} session will be added; {importPreview.summary.sessions.keep} kept.</p>
            <button type="button" className="btn-primary" onClick={handleApplyImport}>Import additively</button>
          </div>
        )}
        {transferMessage && <p className="profile-transfer-status" role="status">{transferMessage}</p>}
        {transferError && <p className="profile-transfer-error" role="alert">{transferError}</p>}
      </section>
      <DiagnosticsPanel />
      <div className="profile-build-footer">
        <span className="build-id-tag">{formatBuildId()}</span>
      </div>
    </div>
  )
}
