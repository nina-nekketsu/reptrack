import React from 'react';

function getDatasetIdentity(sessions) {
  return sessions
    .map((session) => `${session.date || ''}:${Number(session.totalVolume) || 0}`)
    .join('|');
}

export default function VolumeGraph({ sessions }) {
  if (!sessions || sessions.length < 2) {
    return (
      <div className="graph-placeholder">
        Log at least 2 sessions to see your progress graph
      </div>
    );
  }

  const W = 320;
  const H = 120;
  const PAD = { top: 10, right: 14, bottom: 28, left: 40 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const volumes = sessions.map((s) => s.totalVolume || 0);
  const minV = Math.min(...volumes);
  const maxV = Math.max(...volumes);
  const range = maxV - minV || 1;

  const toX = (i) => PAD.left + (i / (sessions.length - 1)) * innerW;
  const toY = (v) => PAD.top + innerH - ((v - minV) / range) * innerH;

  const points = sessions.map((s, i) => ({ x: toX(i), y: toY(s.totalVolume || 0), session: s }));
  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${PAD.left.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z`;

  const yTicks = [minV, minV + range / 2, maxV];
  const formatKg = (v) => v >= 1000 ? `${(v / 1000).toFixed(1)}t` : `${Math.round(v)}`;
  const fmtDate = (iso) =>
    new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const datasetIdentity = getDatasetIdentity(sessions);
  const graphLabel = `Volume over time, ${sessions.length} sessions, ${Math.round(volumes[0]).toLocaleString()} kg to ${Math.round(volumes[volumes.length - 1]).toLocaleString()} kg`;

  return (
    <div className="graph-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="volume-graph" role="img" aria-label={graphLabel}>
        <defs>
          <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--go)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--go)" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => (
          <line key={i} x1={PAD.left} y1={toY(v)} x2={PAD.left + innerW} y2={toY(v)}
            stroke="var(--line)" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        <g key={datasetIdentity} className="volume-graph__plot" data-testid="volume-graph-plot">
          <path className="volume-graph__area" d={areaPath} fill="url(#volGrad)" />
          <path className="volume-graph__line" d={linePath} fill="none" stroke="var(--go)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <circle className="volume-graph__point" key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--go)" stroke="var(--ink-hi)" strokeWidth="1.5" />
          ))}
        </g>
        {yTicks.map((v, i) => (
          <text key={i} x={PAD.left - 4} y={toY(v) + 4} textAnchor="end" fontSize="9" fill="var(--ink-low)">
            {formatKg(v)}
          </text>
        ))}
        <text x={PAD.left} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--ink-low)">
          {fmtDate(sessions[0].date)}
        </text>
        <text x={PAD.left + innerW} y={H - 4} textAnchor="middle" fontSize="9" fill="var(--ink-low)">
          {fmtDate(sessions[sessions.length - 1].date)}
        </text>
        <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH}
          stroke="var(--line-strong)" strokeWidth="1" />
      </svg>
    </div>
  );
}
