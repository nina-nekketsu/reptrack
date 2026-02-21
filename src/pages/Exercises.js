import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Page.css';
import './Exercises.css';
import {
  createStopwatch,
  createCountdown,
  formatMs,
  playBeep,
  vibrate,
  loadRestDefault,
  saveRestDefault,
  loadAutoStart,
  saveAutoStart,
} from '../utils/timer';

const MUSCLE_GROUPS = ['All', 'Chest', 'Back', 'Legs', 'Shoulders', 'Arms', 'Core'];

const defaultExercises = [
  { id: 1, name: 'Bench Press', muscleGroup: 'Chest', type: 'Strength' },
  { id: 2, name: 'Squat', muscleGroup: 'Legs', type: 'Strength' },
  { id: 3, name: 'Deadlift', muscleGroup: 'Back', type: 'Strength' },
  { id: 4, name: 'Overhead Press', muscleGroup: 'Shoulders', type: 'Strength' },
  { id: 5, name: 'Bicep Curl', muscleGroup: 'Arms', type: 'Strength' },
  { id: 6, name: 'Pull-ups', muscleGroup: 'Back', type: 'Strength' },
  { id: 7, name: 'Tricep Dips', muscleGroup: 'Arms', type: 'Strength' },
  { id: 8, name: 'Plank', muscleGroup: 'Core', type: 'Strength' },
];

// ── LocalStorage helpers ──
function loadExercises() {
  try {
    const saved = localStorage.getItem('exercises');
    return saved ? JSON.parse(saved) : defaultExercises;
  } catch {
    return defaultExercises;
  }
}

function loadLogs() {
  try {
    const saved = localStorage.getItem('exerciseLogs');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

function saveLogs(logs) {
  localStorage.setItem('exerciseLogs', JSON.stringify(logs));
}

function saveExercises(exercises) {
  localStorage.setItem('exercises', JSON.stringify(exercises));
}

// ── Calculations ──
function calcTotals(sets) {
  const totalReps = sets.reduce((sum, s) => sum + (Number(s.reps) || 0), 0);
  const totalVolume = sets.reduce(
    (sum, s) => sum + (Number(s.reps) || 0) * (Number(s.weight) || 0),
    0
  );
  return { totalReps, totalVolume };
}

function bestSet(sets) {
  if (!sets || sets.length === 0) return null;
  return sets.reduce((best, s) => {
    const score = (Number(s.weight) || 0) * (1 + (Number(s.reps) || 0) / 30);
    const bestScore = (Number(best.weight) || 0) * (1 + (Number(best.reps) || 0) / 30);
    return score > bestScore ? s : best;
  }, sets[0]);
}

function getRecords(sessions) {
  if (!sessions || sessions.length === 0) return { maxWeight: null, maxReps: null, maxVolume: null };
  let maxWeight = 0;
  let maxReps = 0;
  let maxVolume = 0;
  sessions.forEach((session) => {
    session.sets.forEach((s) => {
      const w = Number(s.weight) || 0;
      const r = Number(s.reps) || 0;
      if (w > maxWeight) maxWeight = w;
      if (r > maxReps) maxReps = r;
    });
    if ((session.totalVolume || 0) > maxVolume) maxVolume = session.totalVolume || 0;
  });
  return { maxWeight, maxReps, maxVolume };
}

function getSessionsAsc(logs, exerciseId) {
  const entry = logs[exerciseId];
  if (!entry) return [];
  return [...entry].sort((a, b) => new Date(a.date) - new Date(b.date));
}

function getSessionsDesc(logs, exerciseId) {
  const entry = logs[exerciseId];
  if (!entry) return [];
  return [...entry].sort((a, b) => new Date(b.date) - new Date(a.date));
}

// ── SVG Volume Graph ──
function VolumeGraph({ sessions }) {
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

// ── Record Badges ──
function RecordBadges({ records }) {
  if (!records.maxWeight && !records.maxReps && !records.maxVolume) return null;
  return (
    <div className="record-badges">
      {records.maxWeight > 0 && (
        <div className="record-chip">
          <span className="record-icon">🏋️</span>
          <span className="record-label">Best Weight</span>
          <span className="record-value">{records.maxWeight} kg</span>
        </div>
      )}
      {records.maxReps > 0 && (
        <div className="record-chip">
          <span className="record-icon">🔁</span>
          <span className="record-label">Most Reps</span>
          <span className="record-value">{records.maxReps}</span>
        </div>
      )}
      {records.maxVolume > 0 && (
        <div className="record-chip">
          <span className="record-icon">📈</span>
          <span className="record-label">Best Volume</span>
          <span className="record-value">{records.maxVolume.toLocaleString()} kg</span>
        </div>
      )}
    </div>
  );
}

// ── Timer state machine constants ──
const TIMER_IDLE       = 'idle';
const TIMER_EXERCISING = 'exercising';
const TIMER_RESTING    = 'resting';
const TIMER_ALERT      = 'alert';       // last 5s of rest
const ALERT_THRESHOLD  = 5000;          // ms

// Flash colours for alert phase: white → green → black → white (repeating)
const FLASH_COLORS = ['#ffffff', '#00cc44', '#000000'];

// ── SetTimer component ──
function SetTimer({ exerciseId, onClose }) {
  // Persistent defaults
  const [restSeconds, setRestSeconds] = useState(() => loadRestDefault(exerciseId));
  const [autoStart, setAutoStart]     = useState(loadAutoStart);

  // Timer state (display only — actual time comes from refs)
  const [timerState, setTimerState]   = useState(TIMER_IDLE);
  const [exerciseMs, setExerciseMs]   = useState(0);
  const [restMs, setRestMs]           = useState(0);
  const [flashIdx, setFlashIdx]       = useState(0);

  // Clock refs — survive renders without causing re-renders
  const stopwatchRef  = useRef(createStopwatch());
  const countdownRef  = useRef(null); // created fresh each rest
  const intervalRef   = useRef(null);
  const flashIntervalRef = useRef(null);
  const timerStateRef = useRef(TIMER_IDLE); // mirror for callbacks
  const autoStartRef  = useRef(autoStart);

  // Keep autoStartRef in sync
  useEffect(() => {
    autoStartRef.current = autoStart;
  }, [autoStart]);

  // ── Tick handler — runs every 100ms ──
  const tick = useCallback(() => {
    const state = timerStateRef.current;

    if (state === TIMER_EXERCISING) {
      setExerciseMs(stopwatchRef.current.getElapsed());
    }

    if (state === TIMER_RESTING || state === TIMER_ALERT) {
      const remaining = countdownRef.current?.getRemaining() ?? 0;
      setRestMs(remaining);

      if (state === TIMER_RESTING && remaining <= ALERT_THRESHOLD && remaining > 0) {
        enterAlert();
      }

      if (remaining <= 0 && (state === TIMER_RESTING || state === TIMER_ALERT)) {
        handleRestEnd();
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Start tick interval ──
  function startInterval() {
    if (intervalRef.current) return;
    intervalRef.current = setInterval(tick, 100);
  }

  function stopInterval() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  // ── Flash interval for alert phase ──
  function startFlash() {
    if (flashIntervalRef.current) return;
    setFlashIdx(0);
    let idx = 0;
    flashIntervalRef.current = setInterval(() => {
      idx = (idx + 1) % FLASH_COLORS.length;
      setFlashIdx(idx);
    }, 400);
  }

  function stopFlash() {
    if (flashIntervalRef.current) {
      clearInterval(flashIntervalRef.current);
      flashIntervalRef.current = null;
    }
    setFlashIdx(0);
  }

  // ── State transitions ──
  function enterExercising() {
    stopwatchRef.current.reset();
    stopwatchRef.current.start();
    timerStateRef.current = TIMER_EXERCISING;
    setTimerState(TIMER_EXERCISING);
    setExerciseMs(0);
    startInterval();
  }

  function enterResting() {
    // Cancel exercise timer
    stopwatchRef.current.stop();
    stopwatchRef.current.reset();
    setExerciseMs(0);

    // Create fresh countdown
    const durationMs = restSeconds * 1000;
    countdownRef.current = createCountdown(durationMs);
    countdownRef.current.start();

    timerStateRef.current = TIMER_RESTING;
    setTimerState(TIMER_RESTING);
    setRestMs(durationMs);
    startInterval();
  }

  function enterAlert() {
    timerStateRef.current = TIMER_ALERT;
    setTimerState(TIMER_ALERT);
    startFlash();
  }

  function handleRestEnd() {
    countdownRef.current?.reset();
    countdownRef.current = null;
    stopFlash();

    // Trigger alerts
    vibrate();
    playBeep();

    if (autoStartRef.current) {
      // Auto-start next exercise set
      enterExercising();
    } else {
      timerStateRef.current = TIMER_IDLE;
      setTimerState(TIMER_IDLE);
      setRestMs(0);
      stopInterval();
    }
  }

  function resetAll() {
    stopwatchRef.current.stop();
    stopwatchRef.current.reset();
    countdownRef.current?.reset();
    countdownRef.current = null;
    stopInterval();
    stopFlash();
    timerStateRef.current = TIMER_IDLE;
    setTimerState(TIMER_IDLE);
    setExerciseMs(0);
    setRestMs(0);
  }

  // ── Button handlers ──
  function handleStart() {
    // Start always cancels rest and begins exercising
    if (timerStateRef.current === TIMER_RESTING || timerStateRef.current === TIMER_ALERT) {
      countdownRef.current?.stop();
      stopFlash();
    }
    enterExercising();
  }

  function handleRest() {
    // Ignore if already resting/alert
    if (timerStateRef.current === TIMER_RESTING || timerStateRef.current === TIMER_ALERT) return;
    enterResting();
  }

  function handleStop() {
    resetAll();
  }

  // ── Clean up on unmount / modal close ──
  useEffect(() => {
    // Capture refs at effect registration time for safe cleanup
    const sw = stopwatchRef.current;
    const iv = intervalRef;
    const fi = flashIntervalRef;
    const cd = countdownRef;
    return () => {
      sw.stop();
      sw.reset();
      cd.current?.reset();
      clearInterval(iv.current);
      clearInterval(fi.current);
    };
  }, []);

  // ── Persist settings ──
  function handleRestSecondsChange(val) {
    const n = Math.max(5, Math.min(600, Number(val) || 90));
    setRestSeconds(n);
    saveRestDefault(exerciseId, n);
  }

  function handleAutoStartToggle() {
    const next = !autoStart;
    setAutoStart(next);
    saveAutoStart(next);
  }

  // ── Derived display ──
  const isIdle       = timerState === TIMER_IDLE;
  const isExercising = timerState === TIMER_EXERCISING;
  const isResting    = timerState === TIMER_RESTING || timerState === TIMER_ALERT;
  const isAlert      = timerState === TIMER_ALERT;

  // Alert overlay colour (flashing)
  const flashColor = isAlert ? FLASH_COLORS[flashIdx] : 'transparent';

  // Text colour for rest timer during alert — ensure contrast
  const restTextColor = isAlert
    ? (flashColor === '#000000' ? '#ffffff' : '#000000')
    : '#e05555';

  return (
    <div className={`set-timer ${isAlert ? 'set-timer--alert' : ''}`}>
      {/* Alert flash overlay */}
      {isAlert && (
        <div
          className="timer-flash-overlay"
          style={{ backgroundColor: flashColor }}
          aria-hidden="true"
        />
      )}

      {/* ── Exercise timer ── */}
      <div className={`timer-block timer-block--exercise ${isExercising ? 'timer-block--active' : ''}`}>
        <div className="timer-label">Exercise Timer</div>
        <div className="timer-display timer-display--exercise">
          {formatMs(exerciseMs)}
        </div>
      </div>

      {/* ── Rest timer ── */}
      <div className={`timer-block timer-block--rest ${isResting ? 'timer-block--active' : ''} ${isAlert ? 'timer-block--alert' : ''}`}>
        <div className="timer-label">Rest Timer</div>
        <div
          className="timer-display timer-display--rest"
          style={isAlert ? { color: restTextColor, position: 'relative', zIndex: 2 } : {}}
        >
          {isResting ? formatMs(restMs) : formatMs(restSeconds * 1000)}
        </div>
        {isAlert && (
          <div className="timer-alert-label" style={{ color: restTextColor, position: 'relative', zIndex: 2 }}>
            GET READY!
          </div>
        )}
      </div>

      {/* ── Controls ── */}
      <div className="timer-controls">
        <button
          className={`timer-btn timer-btn--start ${isExercising ? 'timer-btn--active' : ''}`}
          onClick={handleStart}
          title={isExercising ? 'Already exercising' : isResting ? 'Cancel rest & start' : 'Start exercise timer'}
        >
          {isExercising ? '▶ Running' : isResting ? '▶ Start (cancel rest)' : '▶ Start'}
        </button>

        <button
          className={`timer-btn timer-btn--rest ${isResting ? 'timer-btn--active' : ''}`}
          onClick={handleRest}
          disabled={isResting}
          title={isResting ? 'Already resting' : 'Stop exercise & start rest'}
        >
          {isResting ? '💤 Resting…' : '💤 Rest'}
        </button>

        {!isIdle && (
          <button className="timer-btn timer-btn--stop" onClick={handleStop} title="Stop & reset">
            ✕ Reset
          </button>
        )}
      </div>

      {/* ── Settings row ── */}
      <div className="timer-settings">
        <div className="timer-setting-row">
          <label className="timer-setting-label" htmlFor="rest-seconds">
            Rest duration (s)
          </label>
          <input
            id="rest-seconds"
            className="timer-setting-input"
            type="number"
            min="5"
            max="600"
            step="5"
            value={restSeconds}
            onChange={(e) => handleRestSecondsChange(e.target.value)}
            disabled={isResting}
          />
        </div>
        <div className="timer-setting-row">
          <label className="timer-setting-label" htmlFor="auto-start-toggle">
            Auto-start after rest
          </label>
          <button
            id="auto-start-toggle"
            className={`timer-toggle ${autoStart ? 'timer-toggle--on' : ''}`}
            onClick={handleAutoStartToggle}
            role="switch"
            aria-checked={autoStart}
          >
            <span className="timer-toggle-knob" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PR Block: all-time bests for a given exercise ──
function PRBlock({ logs, exerciseId }) {
  const sessions = getSessionsDesc(logs, exerciseId);
  if (sessions.length === 0) return null;

  // All-time best set by volume (reps × weight)
  let allTimeBestSet = null;
  let allTimeBestVol = 0;
  sessions.forEach((session) => {
    session.sets.forEach((s) => {
      const vol = (Number(s.reps) || 0) * (Number(s.weight) || 0);
      if (vol > allTimeBestVol) {
        allTimeBestVol = vol;
        allTimeBestSet = s;
      }
    });
  });

  // Best session volume
  const bestSessionVol = Math.max(...sessions.map((s) => s.totalVolume || 0));

  // Last session volume
  const lastVol = sessions[0]?.totalVolume || 0;
  const prevVol = sessions[1]?.totalVolume || null;
  const volDiff = prevVol !== null ? lastVol - prevVol : null;

  return (
    <div className="pr-block">
      <div className="pr-block__title">Personal Records</div>
      <div className="pr-block__grid">
        {allTimeBestSet && (
          <div className="pr-item">
            <span className="pr-item__icon">🏆</span>
            <span className="pr-item__label">Best Set</span>
            <span className="pr-item__value">
              {allTimeBestSet.reps} × {allTimeBestSet.weight} kg
            </span>
          </div>
        )}
        <div className="pr-item">
          <span className="pr-item__icon">📈</span>
          <span className="pr-item__label">Best Session</span>
          <span className="pr-item__value">{bestSessionVol.toLocaleString()} kg</span>
        </div>
        <div className="pr-item">
          <span className="pr-item__icon">🕐</span>
          <span className="pr-item__label">Last Session</span>
          <span className="pr-item__value">
            {lastVol.toLocaleString()} kg
            {volDiff !== null && (
              <span className={`pr-diff ${volDiff >= 0 ? 'pr-diff--up' : 'pr-diff--down'}`}>
                {volDiff >= 0 ? ' ▲' : ' ▼'}{Math.abs(volDiff).toLocaleString()}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Progress Graph Block (collapsible) ──
function ProgressGraphBlock({ logs, exerciseId }) {
  const [open, setOpen] = useState(false);
  const sessionsAsc = getSessionsAsc(logs, exerciseId);
  const sessionsDesc = getSessionsDesc(logs, exerciseId);
  const last5 = sessionsDesc.slice(0, 5).reverse(); // oldest first for display

  if (sessionsAsc.length === 0) return null;

  return (
    <div className="progress-graph-block">
      <button
        className="progress-graph-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{open ? '▾' : '▸'} {open ? 'Hide progress graph' : 'Show progress graph'}</span>
      </button>

      {open && (
        <div className="progress-graph-content">
          <VolumeGraph sessions={sessionsAsc} />

          {last5.length > 0 && (
            <div className="last5-sessions">
              <div className="last5-title">Last {last5.length} sessions</div>
              {[...last5].reverse().map((session, i) => {
                const prev = [...last5].reverse()[i + 1];
                const diff = prev ? session.totalVolume - prev.totalVolume : null;
                return (
                  <div className="last5-row" key={session.date}>
                    <span className="last5-date">
                      {new Date(session.date).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <span className="last5-vol">{session.totalVolume.toLocaleString()} kg</span>
                    {diff !== null && (
                      <span className={`pr-diff ${diff >= 0 ? 'pr-diff--up' : 'pr-diff--down'}`}>
                        {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toLocaleString()}
                      </span>
                    )}
                    {session.bestSet && (
                      <span className="last5-best">
                        {session.bestSet.reps}×{session.bestSet.weight}kg
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Exercises component ──
export default function Exercises() {
  const [exercises, setExercises] = useState(loadExercises);
  const [logs, setLogs] = useState(loadLogs);
  const [filter, setFilter] = useState('All');
  const [selected, setSelected] = useState(null);
  const [sets, setSets] = useState([{ reps: '', weight: '' }]);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newGroup, setNewGroup] = useState('Chest');
  const [historyFor, setHistoryFor] = useState(null);

  const filtered =
    filter === 'All' ? exercises : exercises.filter((e) => e.muscleGroup === filter);

  // ── Logging handlers ──
  function openLog(exercise) {
    setSelected(exercise);
    setSets([{ reps: '', weight: '' }]);
  }

  function closeLog() {
    setSelected(null);
    setSets([{ reps: '', weight: '' }]);
    // SetTimer cleanup happens via its own useEffect on unmount
  }

  function updateSet(index, field, value) {
    setSets((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function addSet() {
    setSets((prev) => [...prev, { reps: '', weight: '' }]);
  }

  function removeSet(index) {
    setSets((prev) => prev.filter((_, i) => i !== index));
  }

  function saveSession() {
    const validSets = sets.filter((s) => s.reps !== '' || s.weight !== '');
    if (validSets.length === 0) return;

    const best = bestSet(validSets);
    const session = {
      date: new Date().toISOString(),
      sets: validSets,
      bestSet: best,
      ...calcTotals(validSets),
    };

    const updated = {
      ...logs,
      [selected.id]: [...(logs[selected.id] || []), session],
    };
    setLogs(updated);
    saveLogs(updated);
    closeLog();
  }

  // ── Add exercise ──
  function addExercise() {
    if (!newName.trim()) return;
    const next = [
      ...exercises,
      { id: Date.now(), name: newName.trim(), muscleGroup: newGroup, type: 'Strength' },
    ];
    setExercises(next);
    saveExercises(next);
    setNewName('');
    setShowAdd(false);
  }

  // ── Derived helpers ──
  function lastSession(exerciseId) {
    const sessions = getSessionsDesc(logs, exerciseId);
    return sessions[0] || null;
  }

  function progressBadge(exerciseId) {
    const sessions = getSessionsDesc(logs, exerciseId);
    if (sessions.length < 2) return null;
    const diff = sessions[0].totalVolume - sessions[1].totalVolume;
    if (diff === 0) return null;
    return { diff, up: diff > 0 };
  }

  const liveTotals = calcTotals(sets);
  const logScrollRef = useRef(null);

  function scrollToTop() {
    if (logScrollRef.current) {
      logScrollRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  const historyExercise = exercises.find((e) => e.id === historyFor);
  const historySessionsDesc = historyFor ? getSessionsDesc(logs, historyFor) : [];
  const historySessionsAsc  = historyFor ? getSessionsAsc(logs, historyFor)  : [];
  const historyRecords = historyFor ? getRecords(historySessionsDesc) : {};

  return (
    <div className="page">
      <h2 className="page-heading">Exercises</h2>
      <p className="page-sub">Tap an exercise to view progress · ＋ to log a session</p>

      {/* Muscle group filter */}
      <div className="filter-row">
        {MUSCLE_GROUPS.map((g) => (
          <button
            key={g}
            className={`filter-chip ${filter === g ? 'active' : ''}`}
            onClick={() => setFilter(g)}
          >
            {g}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <div className="exercise-list">
        {filtered.map((ex) => {
          const last = lastSession(ex.id);
          const badge = progressBadge(ex.id);
          return (
            <div
              className="exercise-card ex-card-row"
              key={ex.id}
              onClick={() => setHistoryFor(ex.id)}
            >
              <div className="ex-info">
                <div className="exercise-name">{ex.name}</div>
                <div className="exercise-meta">{ex.muscleGroup}</div>
                {last && (
                  <div className="ex-last">
                    Last: {last.totalReps} reps · {last.totalVolume.toLocaleString()} kg vol
                    {badge && (
                      <span className={`overload-badge ${badge.up ? 'up' : 'down'}`}>
                        {badge.up ? '▲' : '▼'} {Math.abs(badge.diff).toLocaleString()} kg
                      </span>
                    )}
                  </div>
                )}
              </div>
              <div className="ex-actions" onClick={(e) => e.stopPropagation()}>
                <button className="icon-btn" onClick={() => openLog(ex)} title="Log session">
                  ＋
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add exercise */}
      {showAdd ? (
        <div className="add-exercise-form">
          <input
            className="ex-input"
            placeholder="Exercise name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addExercise()}
            autoFocus
          />
          <select
            className="ex-select"
            value={newGroup}
            onChange={(e) => setNewGroup(e.target.value)}
          >
            {MUSCLE_GROUPS.filter((g) => g !== 'All').map((g) => (
              <option key={g}>{g}</option>
            ))}
          </select>
          <div className="add-form-actions">
            <button className="btn-primary" style={{ flex: 1 }} onClick={addExercise}>
              Add
            </button>
            <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button className="btn-secondary" onClick={() => setShowAdd(true)}>
          + Add Exercise
        </button>
      )}

      {/* ── Log session modal ── */}
      {selected && (
        <div className="modal-overlay" onClick={closeLog}>
          <div className="modal modal--log" onClick={(e) => e.stopPropagation()}>

            {/* ── Sticky timer zone (never scrolls away) ── */}
            <div id="log-timer-top" className="log-timer-zone">
              <h3 className="modal-title">{selected.name}</h3>
              <p className="modal-sub">{selected.muscleGroup} · Log your sets</p>
              <SetTimer exerciseId={selected.id} onClose={closeLog} />
            </div>

            {/* ── Scrollable body ── */}
            <div className="log-scroll-body" ref={logScrollRef}>
              <div className="modal-divider" />

              {/* ── PR Block: always-visible all-time bests ── */}
              <PRBlock logs={logs} exerciseId={selected.id} />

              {/* ── Progress Graph Block: collapsible ── */}
              <ProgressGraphBlock logs={logs} exerciseId={selected.id} />

              {logs[selected.id]?.length > 0 && <div className="modal-divider" />}

              <div className="sets-header">
                <span>Set</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                <span></span>
              </div>

              {sets.map((s, i) => {
                const allSessions = getSessionsDesc(logs, selected.id);
                const recordForSet = allSessions.reduce((best, session) => {
                  const setData = session.sets[i];
                  if (!setData) return best;
                  const vol = (Number(setData.reps) || 0) * (Number(setData.weight) || 0);
                  return vol > best ? vol : best;
                }, 0);
                const currentVol = (Number(s.reps) || 0) * (Number(s.weight) || 0);
                const isRecord = currentVol > 0 && currentVol >= recordForSet && recordForSet > 0;

                return (
                  <div className={`set-row ${isRecord ? 'set-row--record' : ''}`} key={i}>
                    <span className="set-num">{isRecord ? '🏆' : i + 1}</span>
                    <input
                      className="set-input"
                      type="number"
                      min="0"
                      placeholder="0"
                      value={s.reps}
                      onChange={(e) => updateSet(i, 'reps', e.target.value)}
                    />
                    <input
                      className="set-input"
                      type="number"
                      min="0"
                      step="0.5"
                      placeholder="0"
                      value={s.weight}
                      onChange={(e) => updateSet(i, 'weight', e.target.value)}
                    />
                    <button
                      className="remove-set-btn"
                      onClick={() => removeSet(i)}
                      disabled={sets.length === 1}
                    >
                      ✕
                    </button>
                  </div>
                );
              })}

              <button className="add-set-btn" onClick={addSet}>
                + Add Set
              </button>

              {/* Live totals */}
              <div className="live-totals">
                <div className="total-pill">
                  <span className="total-label">Total Reps</span>
                  <span className="total-value">{liveTotals.totalReps}</span>
                </div>
                <div className="total-pill">
                  <span className="total-label">Total Volume</span>
                  <span className="total-value">{liveTotals.totalVolume.toLocaleString()} kg</span>
                </div>
              </div>

              {/* Progressive overload hint */}
              {(() => {
                const prev = lastSession(selected.id);
                if (!prev) return null;
                const diff = liveTotals.totalVolume - prev.totalVolume;
                return (
                  <div className={`overload-hint ${diff >= 0 ? 'positive' : 'negative'}`}>
                    {diff >= 0
                      ? `▲ +${diff.toLocaleString()} kg vs last session — progressive overload!`
                      : `▼ ${Math.abs(diff).toLocaleString()} kg vs last session`}
                  </div>
                );
              })()}

              <div className="modal-actions">
                <button
                  className="btn-primary"
                  onClick={saveSession}
                  disabled={liveTotals.totalReps === 0 && liveTotals.totalVolume === 0}
                >
                  Save Session
                </button>
                <button className="btn-secondary" onClick={closeLog}>
                  Cancel
                </button>
              </div>

              <button className="back-to-top-btn" onClick={scrollToTop} type="button">
                ↑ Back to timer
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ── Exercise detail / history modal ── */}
      {historyFor && historyExercise && (
        <div className="modal-overlay" onClick={() => setHistoryFor(null)}>
          <div className="modal modal--tall" onClick={(e) => e.stopPropagation()}>
            <div className="detail-header">
              <div>
                <h3 className="modal-title">{historyExercise.name}</h3>
                <p className="modal-sub">
                  {historyExercise.muscleGroup} · {historySessionsDesc.length} session{historySessionsDesc.length !== 1 ? 's' : ''}
                </p>
              </div>
              <button
                className="btn-primary btn--sm"
                onClick={() => { setHistoryFor(null); openLog(historyExercise); }}
              >
                ＋ Log
              </button>
            </div>

            {historySessionsDesc.length === 0 ? (
              <div className="empty-state">
                No sessions yet. Hit ＋ Log to record your first one!
              </div>
            ) : (
              <>
                <div className="section-label">Personal Records</div>
                <RecordBadges records={historyRecords} />

                <div className="section-label">Volume Over Time</div>
                <VolumeGraph sessions={historySessionsAsc} />

                <div className="section-label">Session History</div>
                <div className="history-sessions">
                  {historySessionsDesc.map((session, i) => {
                    const prev = historySessionsDesc[i + 1];
                    const diff = prev ? session.totalVolume - prev.totalVolume : null;
                    return (
                      <div className="session-card" key={session.date}>
                        <div className="session-date">
                          {new Date(session.date).toLocaleDateString('nl-NL', {
                            weekday: 'short',
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })}
                        </div>
                        <div className="session-stats">
                          <span>{session.sets.length} sets</span>
                          <span>{session.totalReps} reps</span>
                          <span>{session.totalVolume.toLocaleString()} kg vol</span>
                          {diff !== null && (
                            <span className={`overload-badge ${diff >= 0 ? 'up' : 'down'}`}>
                              {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toLocaleString()} kg
                            </span>
                          )}
                        </div>
                        {session.bestSet && (
                          <div className="session-best">
                            Best set: <strong>{session.bestSet.reps} reps @ {session.bestSet.weight} kg</strong>
                          </div>
                        )}
                        <div className="session-sets-detail">
                          {session.sets.map((s, j) => (
                            <span key={j} className="set-pill">
                              {s.reps}×{s.weight}kg
                            </span>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <button className="btn-secondary" onClick={() => setHistoryFor(null)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
