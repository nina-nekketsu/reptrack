import React, { useEffect, useMemo, useState } from 'react';

const METRICS = {
  volume: { label: 'Volume', unit: 'kg total' },
  maxWeight: { label: 'Max Weight', unit: 'kg' },
};

const RANGES = [
  { key: '1m', label: '1 Month', months: 1 },
  { key: '3m', label: '3 Months', months: 3 },
  { key: '1y', label: '1 Year', years: 1 },
  { key: 'all', label: 'All' },
];

const W = 320;
const H = 150;
const PAD = { top: 14, right: 16, bottom: 34, left: 48 };
const innerW = W - PAD.left - PAD.right;
const innerH = H - PAD.top - PAD.bottom;

function setIdentitySignature(session) {
  return (session?.sets || [])
    .map((set, index) => [index, set?.clientSetId, set?.weight, set?.reps, set?.setType].join(':'))
    .join('|');
}

function stableSessionId(session, index) {
  const durable = session?.clientSessionId || session?.remoteId || session?.id || session?.sessionId || session?.workoutSessionId;
  if (durable) return String(durable);
  const startedAt = session?.workoutSessionStartedAt || session?.workout?.startedAt || '';
  const date = session?.date || 'undated';
  return `legacy:${date}:${startedAt}:${setIdentitySignature(session)}:${index}`;
}

function validLoggedSets(session) {
  return (session?.sets || []).filter((set) => {
    if (set?.deleted || set?.isDeleted) return false;
    const reps = Number(set?.reps);
    const weight = Number(set?.weight);
    return Number.isFinite(reps) && reps > 0 && Number.isFinite(weight);
  });
}

function sessionTimestamp(session) {
  const value = new Date(session?.date).getTime();
  return Number.isFinite(value) ? value : null;
}

function volumeFor(session) {
  const sets = validLoggedSets(session);
  if (sets.length > 0) {
    return sets.reduce((sum, set) => sum + Number(set.weight) * Number(set.reps), 0);
  }
  const stored = Number(session?.totalVolume);
  return Number.isFinite(stored) ? stored : null;
}

function maxWeightFor(session) {
  const weights = validLoggedSets(session).map((set) => Number(set.weight));
  if (!weights.length) return null;
  return Math.max(...weights);
}

function qualifySessions(sessions) {
  return (Array.isArray(sessions) ? sessions : [])
    .map((session, sourceIndex) => {
      const timestamp = sessionTimestamp(session);
      const volume = volumeFor(session);
      const maxWeight = maxWeightFor(session);
      const id = stableSessionId(session, sourceIndex);
      if (timestamp === null || volume === null || maxWeight === null || session?.deleted || session?.isDeleted) return null;
      return { ...session, id, sourceIndex, timestamp, volume, maxWeight };
    })
    .filter(Boolean)
    .sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id) || a.sourceIndex - b.sourceIndex);
}

function daysInLocalMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0).getDate();
}


function subtractCalendarMonthsClamped(now, months) {
  const date = new Date(now);
  const originalDay = date.getDate();
  const targetMonth = date.getMonth() - months;
  const targetFirst = new Date(
    date.getFullYear(),
    targetMonth,
    1,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
  targetFirst.setDate(Math.min(originalDay, daysInLocalMonth(targetFirst.getFullYear(), targetFirst.getMonth())));
  return targetFirst;
}

function subtractCalendarYearsClamped(now, years) {
  const date = new Date(now);
  const targetYear = date.getFullYear() - years;
  const targetDay = date.getDate();
  const target = new Date(
    targetYear,
    date.getMonth(),
    1,
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds()
  );
  target.setDate(Math.min(targetDay, daysInLocalMonth(targetYear, date.getMonth())));
  return target;
}

function rangeStart(now, rangeKey) {
  if (rangeKey === '1m') return subtractCalendarMonthsClamped(now, 1).getTime();
  if (rangeKey === '3m') return subtractCalendarMonthsClamped(now, 3).getTime();
  if (rangeKey === '1y') return subtractCalendarYearsClamped(now, 1).getTime();
  return Number.NEGATIVE_INFINITY;
}

function filterByRange(sessions, rangeKey, now) {
  const upper = now.getTime();
  const lower = rangeStart(now, rangeKey);
  return sessions.filter((session) => session.timestamp >= lower && session.timestamp <= upper);
}

function formatNumber(value) {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(2)).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatAxis(value) {
  if (Math.abs(value) >= 1000) return `${Number((value / 1000).toFixed(1)).toLocaleString()}k`;
  return formatNumber(value);
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function createYScale(values) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min;
  const padding = range === 0 ? Math.max(Math.abs(max) * 0.1, 1) : range * 0.12;
  const low = min - padding;
  const high = max + padding;
  const span = high - low || 1;
  return {
    ticks: [low, low + span / 2, high],
    yFor: (value) => PAD.top + innerH - ((value - low) / span) * innerH,
  };
}

function xForTimestamp(timestamp, minTimestamp, maxTimestamp, index, count) {
  if (count <= 1 || minTimestamp === maxTimestamp) {
    return count <= 1 ? PAD.left + innerW / 2 : PAD.left + (index / Math.max(count - 1, 1)) * innerW;
  }
  return PAD.left + ((timestamp - minTimestamp) / (maxTimestamp - minTimestamp)) * innerW;
}

function EmptyFrame({ children, testId = 'volume-graph-empty-frame' }) {
  return (
    <div className="graph-placeholder graph-placeholder--frame" data-testid={testId}>
      <svg viewBox={`0 0 ${W} ${H}`} className="volume-graph volume-graph--empty" aria-hidden="true">
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + innerH} />
        <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} />
        <line x1={PAD.left} y1={PAD.top + innerH / 2} x2={PAD.left + innerW} y2={PAD.top + innerH / 2} />
      </svg>
      <p>{children}</p>
    </div>
  );
}

function nearestPointInRenderedPixels(points, clientX, clientY, rect) {
  const nearest = points.reduce((candidate, point) => {
    const renderedX = rect.left + (point.x / W) * rect.width;
    const renderedY = rect.top + (point.y / H) * rect.height;
    const distance = ((renderedX - clientX) ** 2) + ((renderedY - clientY) ** 2);
    if (!candidate || distance < candidate.distance) return { point, distance };
    return candidate;
  }, null);
  return nearest && nearest.distance <= 22 ** 2 ? nearest.point : null;
}

export default function VolumeGraph({ sessions, exerciseId, loading = false, offline = false, error = null, now = new Date() }) {
  const [metric, setMetric] = useState('volume');
  const [range, setRange] = useState('3m');
  const [selectedId, setSelectedId] = useState(null);
  const nowDate = useMemo(() => (now instanceof Date ? now : new Date(now)), [now]);

  useEffect(() => {
    setMetric('volume');
    setRange('3m');
    setSelectedId(null);
  }, [exerciseId]);

  useEffect(() => {
    setSelectedId(null);
  }, [metric, range]);

  const allSessions = useMemo(() => qualifySessions(sessions), [sessions]);
  const visibleSessions = useMemo(() => filterByRange(allSessions, range, nowDate), [allSessions, range, nowDate]);

  if (loading) {
    return <div className="graph-placeholder" role="status">Loading progress graph…</div>;
  }
  if (offline) {
    return <EmptyFrame testId="volume-graph-offline-frame">Data unavailable</EmptyFrame>;
  }
  if (error) {
    return <div className="graph-placeholder" role="alert">Unable to load progress graph.</div>;
  }

  const controls = (
    <div className="volume-graph__controls" aria-label="Exercise progress graph controls">
      <div className="volume-graph__segmented" aria-label="Metric">
        {Object.entries(METRICS).map(([key, config]) => (
          <button key={key} type="button" className={`volume-graph__control ${metric === key ? 'is-selected' : ''}`} aria-pressed={metric === key} onClick={() => setMetric(key)}>
            {config.label}
          </button>
        ))}
      </div>
      <div className="volume-graph__segmented" aria-label="History range">
        {RANGES.map((option) => (
          <button key={option.key} type="button" className={`volume-graph__control ${range === option.key ? 'is-selected' : ''}`} aria-pressed={range === option.key} onClick={() => setRange(option.key)}>
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (allSessions.length < 2) {
    return (
      <div className="graph-wrap graph-wrap--v1">
        {controls}
        <EmptyFrame>Your progress graph will appear after your second logged workout.</EmptyFrame>
      </div>
    );
  }

  if (visibleSessions.length === 0) {
    return (
      <div className="graph-wrap graph-wrap--v1">
        {controls}
        <EmptyFrame testId="volume-graph-range-empty-frame">No workouts in this range.</EmptyFrame>
      </div>
    );
  }

  const metricConfig = METRICS[metric];
  const values = visibleSessions.map((session) => session[metric]);
  const { ticks, yFor } = createYScale(values);
  const minTime = Math.min(...visibleSessions.map((session) => session.timestamp));
  const maxTime = Math.max(...visibleSessions.map((session) => session.timestamp));
  const points = visibleSessions.map((session, index) => ({
    session,
    value: session[metric],
    x: xForTimestamp(session.timestamp, minTime, maxTime, index, visibleSessions.length),
    y: yFor(session[metric]),
  }));
  const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');
  const areaPath = points.length > 1 ? `${linePath} L${points[points.length - 1].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} L${points[0].x.toFixed(1)},${(PAD.top + innerH).toFixed(1)} Z` : '';
  const selected = points.find((point) => point.session.id === selectedId);
  const selectPoint = (point) => setSelectedId(point?.session?.id || null);
  const labelFor = (point) => `${formatDate(point.session.date)} ${formatTime(point.session.date)}, ${metricConfig.label} ${formatNumber(point.value)} ${metricConfig.unit}`;

  function handleCoordinateActivation(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    const clientX = Number.isFinite(event.clientX) ? event.clientX : touch?.clientX;
    const clientY = Number.isFinite(event.clientY) ? event.clientY : touch?.clientY;
    if (!Number.isFinite(clientX) || !Number.isFinite(clientY) || rect.width <= 0 || rect.height <= 0) return;
    selectPoint(nearestPointInRenderedPixels(points, clientX, clientY, rect));
  }

  return (
    <div
      className="graph-wrap graph-wrap--v1"
      onPointerDown={(event) => {
        if (event.target.closest('.volume-graph__interaction-layer, .volume-graph__callout')) return;
        setSelectedId(null);
      }}
    >
      {controls}
      <div className="volume-graph__unit" aria-live="polite">{metricConfig.unit}</div>
      <div className="volume-graph__stage">
        <div
          className="volume-graph__image"
          role="img"
          aria-label={`Exercise progress graph: ${metricConfig.label}, ${visibleSessions.length} visible sessions`}
        >
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="volume-graph"
            aria-hidden="true"
            data-testid="volume-graph-surface"
          >
            <defs>
              <linearGradient id="volGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--go)" stopOpacity="0.25" />
                <stop offset="100%" stopColor="var(--go)" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {ticks.map((tick, index) => (
              <line key={`grid-${index}`} x1={PAD.left} y1={yFor(tick)} x2={PAD.left + innerW} y2={yFor(tick)} stroke="var(--line)" strokeWidth="1" strokeDasharray="3 3" />
            ))}
            <g className="volume-graph__plot" data-testid="volume-graph-plot" data-animated="false">
              {points.length > 1 && <path className="volume-graph__area" d={areaPath} fill="url(#volGrad)" />}
              {points.length > 1 && <path data-testid="volume-graph-line" className="volume-graph__line" d={linePath} fill="none" stroke="var(--go)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />}
              {points.map((point) => (
                <circle key={point.session.id} className="volume-graph__point" cx={point.x} cy={point.y} r="3.5" fill="var(--go)" stroke="var(--ink-hi)" strokeWidth="1.5" />
              ))}
            </g>
            {ticks.map((tick, index) => (
              <text key={`tick-${index}`} className="volume-graph__axis-label" x={PAD.left - 4} y={yFor(tick) + 4} textAnchor="end" fill="var(--ink-low)">{formatAxis(tick)}</text>
            ))}
            <text className="volume-graph__axis-label volume-graph__date-label" x={PAD.left} y={H - 8} textAnchor="middle" fill="var(--ink-low)">{formatDate(visibleSessions[0].date)}</text>
            <text className="volume-graph__axis-label volume-graph__date-label" x={PAD.left + innerW} y={H - 8} textAnchor="middle" fill="var(--ink-low)">{formatDate(visibleSessions[visibleSessions.length - 1].date)}</text>
            <line x1={PAD.left} y1={PAD.top + innerH} x2={PAD.left + innerW} y2={PAD.top + innerH} stroke="var(--line-strong)" strokeWidth="1" />
          </svg>
        </div>
        <div
          className="volume-graph__interaction-layer"
          data-testid="volume-graph-interaction-layer"
          onPointerDown={handleCoordinateActivation}
          onTouchStart={handleCoordinateActivation}
        >
          {points.map((point) => (
            <button
              key={point.session.id}
              type="button"
              data-testid="volume-graph-point-control"
              className="volume-graph__point-control"
              data-session-id={point.session.id}
              aria-label={labelFor(point)}
              ref={(element) => {
                if (!element) return;
                element.style.left = `${(point.x / W) * 100}%`;
                element.style.top = `${(point.y / H) * 100}%`;
              }}
              onClick={(event) => {
                event.stopPropagation();
                if (event.detail === 0) selectPoint(point);
              }}
            />
          ))}
        </div>
      </div>
      {selected && (
        <div className="volume-graph__callout" role="status" aria-label="Selected session">
          {formatDate(selected.session.date)} · {formatTime(selected.session.date)} · {formatNumber(selected.value)} {metricConfig.unit}
        </div>
      )}
    </div>
  );
}
