// src/pages/CoachView.js
// Read-only coach dashboard — no login required.
// Accessed via /#/coach/:token

import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { getCoachData } from '../lib/coachShare';
import { isConfigured } from '../lib/supabase';
import './CoachView.css';

// ── Tiny inline volume graph (SVG, no extra deps) ────────────────────────────
function MiniVolumeGraph({ history }) {
  if (!history || history.length < 2) {
    return (
      <p className="cv-empty">Not enough sessions to draw a graph yet.</p>
    );
  }

  const W = 320, H = 120;
  const PAD = { top: 10, right: 14, bottom: 28, left: 44 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;

  const volumes = history.map((s) => Number(s.total_volume_kg) || 0);
  const minV = Math.min(...volumes);
  const maxV = Math.max(...volumes);
  const range = maxV - minV || 1;

  const toX = (i) => PAD.left + (i / (history.length - 1)) * iW;
  const toY = (v) => PAD.top + iH - ((v - minV) / range) * iH;

  const pts = history.map((s, i) => ({ x: toX(i), y: toY(Number(s.total_volume_kg) || 0) }));
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.top + iH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + iH).toFixed(1)} Z`;

  const yTicks = [minV, minV + range / 2, maxV];
  const fmt = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)}`;
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

  return (
    <div className="cv-graph-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="cv-volume-svg">
        <defs>
          <linearGradient id="cvGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#7c6af7" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#7c6af7" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => (
          <line key={i} x1={PAD.left} y1={toY(v)} x2={PAD.left + iW} y2={toY(v)}
            stroke="#2a2a4a" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        <path d={area} fill="url(#cvGrad)" />
        <path d={line} fill="none" stroke="#7c6af7" strokeWidth="2.2"
          strokeLinecap="round" strokeLinejoin="round" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#7c6af7" stroke="#16162a" strokeWidth="1.5" />
        ))}
        {yTicks.map((v, i) => (
          <text key={i} x={PAD.left - 5} y={toY(v) + 4} textAnchor="end" fontSize="9" fill="#9999b3">
            {fmt(v)}
          </text>
        ))}
        <text x={PAD.left} y={H - 4} textAnchor="middle" fontSize="9" fill="#9999b3">
          {fmtDate(history[0].date)}
        </text>
        <text x={PAD.left + iW} y={H - 4} textAnchor="middle" fontSize="9" fill="#9999b3">
          {fmtDate(history[history.length - 1].date)}
        </text>
        <line x1={PAD.left} y1={PAD.top + iH} x2={PAD.left + iW} y2={PAD.top + iH}
          stroke="#2a2a4a" strokeWidth="1" />
      </svg>
    </div>
  );
}

// ── Main CoachView component ─────────────────────────────────────────────────
export default function CoachView() {
  const { token } = useParams();
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  const load = useCallback(async () => {
    if (!isConfigured) {
      setError('Supabase is not configured. Coach links require cloud sync to be set up.');
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const result = await getCoachData(token);
      if (result === null) {
        setError('This link is invalid or sharing has been disabled by the athlete.');
      } else {
        setData(result);
      }
    } catch (err) {
      console.error('[CoachView] load error:', err);
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="cv-screen">
        <div className="cv-card" style={{ textAlign: 'center' }}>
          <div className="cv-logo">💪</div>
          <p className="cv-muted">Loading athlete data…</p>
        </div>
      </div>
    );
  }

  // ── Error / invalid token ────────────────────────────────────────────────
  if (error) {
    return (
      <div className="cv-screen">
        <div className="cv-card" style={{ textAlign: 'center' }}>
          <div className="cv-logo">🔒</div>
          <h2 className="cv-title">Access Denied</h2>
          <p className="cv-muted">{error}</p>
        </div>
      </div>
    );
  }

  // ── Dashboard ────────────────────────────────────────────────────────────
  const exercises    = data.exercises      || [];
  const lastSession  = data.last_session   || {};
  const prs          = data.prs            || [];
  const volumeHistory = data.volume_history || [];
  const syncedAt     = data.synced_at;

  const fmtDateTime = (iso) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('nl-NL', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  return (
    <div className="cv-screen">
      <div className="cv-shell">

        {/* ── Header ── */}
        <div className="cv-header">
          <span className="cv-logo-inline">💪</span>
          <div>
            <h1 className="cv-title">RepTrack Coach View</h1>
            <p className="cv-muted cv-synced">
              Last synced: <strong>{fmtDateTime(syncedAt)}</strong>
            </p>
          </div>
        </div>

        <p className="cv-readonly-badge">👁 Read-only — no login required</p>

        {/* ── Exercises ── */}
        <section className="cv-section">
          <h2 className="cv-section-title">Exercises ({exercises.length})</h2>
          {exercises.length === 0 ? (
            <p className="cv-empty">No exercises logged yet.</p>
          ) : (
            <div className="cv-exercise-grid">
              {exercises.map((ex) => (
                <div className="cv-exercise-card" key={ex.id || ex.local_id}>
                  <span className="cv-ex-name">{ex.name}</span>
                  <span className="cv-ex-meta">{ex.muscle_group} · {ex.type}</span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Last Session ── */}
        <section className="cv-section">
          <h2 className="cv-section-title">Last Session</h2>
          {!lastSession.exercise_name ? (
            <p className="cv-empty">No sessions recorded yet.</p>
          ) : (
            <div className="cv-last-session">
              <div className="cv-last-session-meta">
                <strong>{lastSession.exercise_name}</strong>
                <span className="cv-muted">{fmtDateTime(lastSession.started_at)}</span>
              </div>
              <div className="cv-stats-row">
                <div className="cv-stat">
                  <span className="cv-stat-val">{lastSession.total_reps ?? '—'}</span>
                  <span className="cv-stat-lbl">Total Reps</span>
                </div>
                <div className="cv-stat">
                  <span className="cv-stat-val">{lastSession.total_volume_kg != null ? `${lastSession.total_volume_kg} kg` : '—'}</span>
                  <span className="cv-stat-lbl">Volume</span>
                </div>
              </div>
              {lastSession.sets && lastSession.sets.length > 0 && (
                <table className="cv-sets-table">
                  <thead>
                    <tr>
                      <th>Set</th>
                      <th>Reps</th>
                      <th>Weight (kg)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lastSession.sets.map((s) => (
                      <tr key={s.set_number}>
                        <td>{s.set_number}</td>
                        <td>{s.reps ?? '—'}</td>
                        <td>{s.weight_kg ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>

        {/* ── Personal Records ── */}
        <section className="cv-section">
          <h2 className="cv-section-title">Personal Records</h2>
          {prs.length === 0 ? (
            <p className="cv-empty">No PRs yet — keep grinding.</p>
          ) : (
            <div className="cv-pr-list">
              {prs.map((pr, i) => (
                <div className="cv-pr-card" key={i}>
                  <span className="cv-pr-name">{pr.exercise_name}</span>
                  <div className="cv-pr-stats">
                    <span>🏋️ {pr.max_weight_kg ?? '—'} kg</span>
                    <span>🔁 {pr.max_reps ?? '—'} reps</span>
                    <span>📦 {pr.max_volume_kg != null ? `${pr.max_volume_kg} kg vol` : '—'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Volume Graph ── */}
        <section className="cv-section">
          <h2 className="cv-section-title">Volume History</h2>
          <MiniVolumeGraph history={volumeHistory} />
        </section>

        <p className="cv-footer">
          RepTrack · Coach View · Data is read-only and shared by the athlete.
        </p>
      </div>
    </div>
  );
}
