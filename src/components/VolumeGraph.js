import React from 'react';

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
    new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' });

  return (
    <div className="graph-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="volume-graph">
        <defs>
          <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4c4cff" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#4c4cff" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => (
          <line key={i} x1={PAD.left} y1={toY(v)} x2={PAD.left + innerW} y2={toY(v)}
            stroke="#e0e0f0" strokeWidth="1" strokeDasharray="3 3" />
        ))}
        <path d={areaPath} fill="url(#volGrad)" />
        <path d={linePath} fill="none" stroke="#4c4cff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="#4c4cff" stroke="#fff" strokeWidth="1.5" />
        ))}
        {yTicks.map((v, i) => (
          <text key={i} x={PAD.left - 4} y={toY(v) + 4} textAnchor="end" fontSize="9" fill="#9999b3">
            {formatKg(v)}
          </text>
        ))}
        <text x={PAD.left} y={H - 4} textAnchor="middle" fontSize="9" fill="#9999b3">
          {fmtDate(sessions[0].date)}
        </text>
        <text x={PAD.left + innerW} y={H - 4} textAnchor="middle" fontSize="9" fill="#9999b3">
          {fmtDate(sessions[sessions.length - 1].date)}
        </text>
        <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH}
          stroke="#d0d0e8" strokeWidth="1" />
      </svg>
    </div>
  );
}
