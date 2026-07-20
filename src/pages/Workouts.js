import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTimer } from '../context/TimerContext';
import { pushPlan, pushExercise, pushSettings, pushActiveWorkoutSession } from '../lib/sync';
import { reportBackgroundFailure } from '../lib/clientDiagnosticsRuntime';
import {
  getStoredVisibleActiveWorkoutSession,
  saveActiveWorkoutSession,
} from '../lib/activeWorkoutSession';
import Sheet from '../components/Sheet';
import { BoltIcon, CheckIcon, DumbbellIcon, RepeatIcon, TimerIcon, TrendIcon } from '../components/icons';
import './Page.css';
import './Workouts.css';

const GROUP_ICONS = {
  Chest: DumbbellIcon,
  Back: RepeatIcon,
  Legs: TrendIcon,
  Shoulders: DumbbellIcon,
  Arms: DumbbellIcon,
  Core: TimerIcon,
  default: BoltIcon,
};

function MuscleGroupIcon({ muscleGroup }) {
  const Icon = GROUP_ICONS[muscleGroup] || GROUP_ICONS.default;
  return <Icon />;
}

// ── Seed plans ──
const SEED_PLAN_ID = 'legs-biceps-day';
const SEED_PLAN_UB_ID = 'upper-body-day';

function reportSyncFailure(error) {
  reportBackgroundFailure(error, { source: 'sync', category: 'unknown' });
}

const SEED_PLAN = {
  id: SEED_PLAN_ID,
  name: 'Legs & Biceps Day',
  createdAt: new Date().toISOString(),
  exercises: [
    { exerciseId: 'e-slps', prescribedSets: 5, prescribedReps: 16 },
    { exerciseId: 'e-hs',   prescribedSets: 4, prescribedReps: 12 },
    { exerciseId: 'e-le',   prescribedSets: 3, prescribedReps: 20 },
    { exerciseId: 'e-cu',   prescribedSets: 3, prescribedReps: 15 },
    { exerciseId: 'e-llc',  prescribedSets: 3, prescribedReps: 20 },
    { exerciseId: 'e-ic',   prescribedSets: 3, prescribedReps: 15 },
    { exerciseId: 'e-crlp', prescribedSets: 3, prescribedReps: 20 },
    { exerciseId: 'e-rdl',  prescribedSets: 3, prescribedReps: 12 },
    { exerciseId: 'e-pc',   prescribedSets: 3, prescribedReps: 12 },
    { exerciseId: 'e-hc',   prescribedSets: 2, prescribedReps: 12 },
    { exerciseId: 'e-scr',  prescribedSets: 3, prescribedReps: 20 },
  ],
};

const SEED_PLAN_UB = {
  id: SEED_PLAN_UB_ID,
  name: 'Upper Body Day',
  createdAt: new Date().toISOString(),
  exercises: [
    { exerciseId: 'ub-cp',    prescribedSets: 5, prescribedReps: 15 },
    { exerciseId: 'ub-lpwog', prescribedSets: 5, prescribedReps: 15 },
    { exerciseId: 'ub-ibpsm', prescribedSets: 3, prescribedReps: 12 },
    { exerciseId: 'ub-cubw',  prescribedSets: 3, prescribedReps: 12 },
    { exerciseId: 'ub-sp',    prescribedSets: 3, prescribedReps: 12 },
    { exerciseId: 'ub-csrwng',prescribedSets: 3, prescribedReps: 12 },
    { exerciseId: 'ub-lr',    prescribedSets: 3, prescribedReps: 20 },
    { exerciseId: 'ub-rbwg',  prescribedSets: 3, prescribedReps: 20 },
    { exerciseId: 'ub-bwg',   prescribedSets: 3, prescribedReps: 15 },
    { exerciseId: 'ub-plc',   prescribedSets: 3, prescribedReps: 15 },
    { exerciseId: 'ub-plbd',  prescribedSets: 2, prescribedReps: 15 },
    { exerciseId: 'ub-scc',   prescribedSets: 3, prescribedReps: 12 },
    { exerciseId: 'ub-tp',    prescribedSets: 2, prescribedReps: 12 },
    { exerciseId: 'ub-otxr',  prescribedSets: 2, prescribedReps: 15 },
  ],
};

const SEED_EXERCISES = [
  // Legs & Biceps Day
  { id: 'e-slps', name: 'Single Leg Press Sideways',                  muscleGroup: 'Legs',      type: 'Strength' },
  { id: 'e-hs',   name: 'Hack Squats',                                 muscleGroup: 'Legs',      type: 'Strength' },
  { id: 'e-le',   name: 'Leg Extensions',                              muscleGroup: 'Legs',      type: 'Strength' },
  { id: 'e-cu',   name: 'Curls',                                       muscleGroup: 'Arms',      type: 'Strength' },
  { id: 'e-llc',  name: 'Lying Leg Curls',                             muscleGroup: 'Legs',      type: 'Strength' },
  { id: 'e-ic',   name: 'Incline Curls',                               muscleGroup: 'Arms',      type: 'Strength' },
  { id: 'e-crlp', name: 'Calf Raises on Leg Press',                   muscleGroup: 'Legs',      type: 'Strength' },
  { id: 'e-rdl',  name: 'Romanian Deadlifts',                          muscleGroup: 'Legs',      type: 'Strength' },
  { id: 'e-pc',   name: 'Preacher Curls',                              muscleGroup: 'Arms',      type: 'Strength' },
  { id: 'e-hc',   name: 'Hammer Curls',                                muscleGroup: 'Arms',      type: 'Strength' },
  { id: 'e-scr',  name: 'Seated Calf Raises',                          muscleGroup: 'Legs',      type: 'Strength' },
  // Upper Body Day
  { id: 'ub-cp',    name: 'Chest Press',                                muscleGroup: 'Chest',     type: 'Strength' },
  { id: 'ub-lpwog', name: 'Lat Pulldowns with Wide Overhand Grip',      muscleGroup: 'Back',      type: 'Strength' },
  { id: 'ub-ibpsm', name: 'Incline Bench Press (Smith machine)',        muscleGroup: 'Chest',     type: 'Strength' },
  { id: 'ub-cubw',  name: 'Chin-Ups (Bodyweight)',                      muscleGroup: 'Back',      type: 'Strength' },
  { id: 'ub-sp',    name: 'Shoulder Press',                             muscleGroup: 'Shoulders', type: 'Strength' },
  { id: 'ub-csrwng',name: 'Chest-Supported Rows Wide Neutral Grip',    muscleGroup: 'Back',      type: 'Strength' },
  { id: 'ub-lr',    name: 'Lateral Raises',                             muscleGroup: 'Shoulders', type: 'Strength' },
  { id: 'ub-rbwg',  name: 'Reverse Butterfly with Wide Grip',           muscleGroup: 'Back',      type: 'Strength' },
  { id: 'ub-bwg',   name: 'Butterfly with Wide Grip',                   muscleGroup: 'Chest',     type: 'Strength' },
  { id: 'ub-plc',   name: 'Pullovers (Cable)',                          muscleGroup: 'Back',      type: 'Strength' },
  { id: 'ub-plbd',  name: 'Pullovers on Bench (Dumbbells)',             muscleGroup: 'Back',      type: 'Strength' },
  { id: 'ub-scc',   name: 'Skull Crushers (Cable)',                     muscleGroup: 'Arms',      type: 'Strength' },
  { id: 'ub-tp',    name: 'Triceps Pushdowns',                          muscleGroup: 'Arms',      type: 'Strength' },
  { id: 'ub-otxr',  name: 'Overhead Triceps Extensions with Rope',     muscleGroup: 'Arms',      type: 'Strength' },
];

// ── LocalStorage helpers ──
function loadPlans() {
  try {
    const raw = localStorage.getItem('workoutPlans');
    const plans = raw ? JSON.parse(raw) : [];
    let changed = false;
    if (!plans.find(p => p.id === SEED_PLAN_ID)) {
      plans.unshift(SEED_PLAN);
      changed = true;
    }
    if (!plans.find(p => p.id === SEED_PLAN_UB_ID)) {
      // Insert Upper Body Day after Legs & Biceps Day
      const lbIndex = plans.findIndex(p => p.id === SEED_PLAN_ID);
      plans.splice(lbIndex + 1, 0, SEED_PLAN_UB);
      changed = true;
    }
    if (changed) {
      localStorage.setItem('workoutPlans', JSON.stringify(plans));
    }
    return plans;
  } catch {
    return [SEED_PLAN, SEED_PLAN_UB];
  }
}

function savePlans(plans) {
  localStorage.setItem('workoutPlans', JSON.stringify(plans));
}

function loadCurrentPlanId() {
  return localStorage.getItem('currentPlanId') || SEED_PLAN_ID;
}

function saveCurrentPlanId(id) {
  localStorage.setItem('currentPlanId', id);
}

// Merge seed exercises into existing exercises list without overwriting custom ones
function loadAndMergeExercises() {
  try {
    const raw = localStorage.getItem('exercises');
    const existing = raw ? JSON.parse(raw) : [];
    let changed = false;
    for (const seed of SEED_EXERCISES) {
      if (!existing.find(e => e.id === seed.id)) {
        existing.push(seed);
        changed = true;
      }
    }
    if (changed) {
      localStorage.setItem('exercises', JSON.stringify(existing));
    }
    return existing;
  } catch {
    localStorage.setItem('exercises', JSON.stringify(SEED_EXERCISES));
    return SEED_EXERCISES;
  }
}

function saveExercises(exercises) {
  localStorage.setItem('exercises', JSON.stringify(exercises));
}

// ── Format elapsed time ──
function formatElapsed(startIso) {
  if (!startIso) return '';
  const secs = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ═══════════════════════════════════════════
//  EditExerciseModal — tap a row to edit sets/reps
// ═══════════════════════════════════════════
function EditExerciseModal({ planEx, exercise, onSave, onClose }) {
  const [sets, setSets] = useState(String(planEx.prescribedSets));
  const [reps, setReps] = useState(String(planEx.prescribedReps));
  const [superset, setSuperset] = useState(planEx.superset || '');

  function handleSave() {
    const s = Math.max(1, parseInt(sets, 10) || 1);
    const r = Math.max(1, parseInt(reps, 10) || 1);
    onSave(s, r, superset || null);
  }

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="workout-modal__title">{exercise?.name || 'Exercise'}</h3>
          <p className="workout-modal__sub">{exercise?.muscleGroup} · Edit prescription</p>
        </div>

        <div className="prescription-editor">
          <div className="prescription-grid">
            <div>
              <div className="prescription-label">Sets</div>
              <input
                className="prescription-input"
                type="number"
                min="1"
                max="20"
                value={sets}
                onChange={e => setSets(e.target.value)}
                autoFocus
              />
            </div>
            <div className="prescription-x">×</div>
            <div>
              <div className="prescription-label">Reps</div>
              <input
                className="prescription-input"
                type="number"
                min="1"
                max="200"
                value={reps}
                onChange={e => setReps(e.target.value)}
              />
            </div>
          </div>
        </div>
        <label className="prescription-label" htmlFor="superset-group">Superset group</label>
        <select id="superset-group" className="prescription-input" value={superset} onChange={(event) => setSuperset(event.target.value)}>
          <option value="">None</option>
          {['A', 'B', 'C', 'D'].map((group) => <option key={group} value={group}>Group {group}</option>)}
        </select>

        <div className="workout-modal__actions">
          <button className="btn-primary" onClick={handleSave}>Save</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  AddExerciseModal — search existing or create new
// ═══════════════════════════════════════════
function AddExerciseModal({ allExercises, planExerciseIds, onAdd, onClose }) {
  const [query, setQuery] = useState('');
  const [newMuscleGroup, setNewMuscleGroup] = useState('');

  const filtered = allExercises.filter(e => {
    const q = query.toLowerCase();
    return e.name.toLowerCase().includes(q);
  });

  // Exact match for "create new" prompt
  const exactMatch = allExercises.some(
    e => e.name.toLowerCase() === query.toLowerCase()
  );
  const showCreateNew = query.length > 1 && !exactMatch;

  function handlePickExercise(ex) {
    if (planExerciseIds.includes(ex.id)) return; // already in plan
    onAdd(ex);
  }

  function handleCreateNew() {
    const name = query.trim();
    if (!name || !newMuscleGroup) return;
    const newEx = {
      id: `ex-${Date.now()}`,
      name,
      muscleGroup: newMuscleGroup,
      type: 'Strength',
    };
    onAdd(newEx, true);
  }

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="workout-modal__title">Add Exercise</h3>
          <p className="workout-modal__sub">Search or create a new one</p>
        </div>

        <input
          className="exercise-search-input"
          placeholder="Search exercises…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />

        <div className="exercise-search-results">
          {filtered.map(ex => {
            const alreadyIn = planExerciseIds.includes(ex.id);
            return (
              <div
                key={ex.id}
                className={`exercise-search-row ${alreadyIn ? 'exercise-search-row--disabled' : ''}`}
                onClick={() => !alreadyIn && handlePickExercise(ex)}
              >
                <span className="exercise-search-thumb"><MuscleGroupIcon muscleGroup={ex.muscleGroup} /></span>
                <span className="exercise-search-name">{ex.name}</span>
                <span className="exercise-search-meta">{ex.muscleGroup}</span>
                {alreadyIn && <span className="exercise-search-added">Added</span>}
              </div>
            );
          })}

          {showCreateNew && (
            <div className="exercise-create-new">
              <label htmlFor="new-exercise-muscle">Muscle group</label>
              <select id="new-exercise-muscle" value={newMuscleGroup} onChange={(event) => setNewMuscleGroup(event.target.value)}>
                <option value="">Choose a muscle group</option>
                {['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Cardio', 'Other'].map((group) => <option key={group} value={group}>{group}</option>)}
              </select>
              <button type="button" className="exercise-search-row create-new" onClick={handleCreateNew} disabled={!newMuscleGroup}>
                + Create "{query}"
              </button>
            </div>
          )}

          {filtered.length === 0 && !showCreateNew && (
            <p className="exercise-search-empty">
              No exercises found
            </p>
          )}
        </div>

        <button className="btn-secondary" onClick={onClose}>Cancel</button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  NewPlanModal — create a new empty plan
// ═══════════════════════════════════════════
function NewPlanModal({ onSave, onClose }) {
  const [name, setName] = useState('');

  function handleSave() {
    const n = name.trim();
    if (!n) return;
    onSave(n);
  }

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="workout-modal__title">New Plan</h3>
          <p className="workout-modal__sub">Give your workout plan a name</p>
        </div>
        <input
          className="plan-name-input"
          placeholder="e.g. Push Day, Full Body…"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSave()}
          autoFocus
        />
        <div className="workout-modal__actions">
          <button className="btn-primary" onClick={handleSave} disabled={!name.trim()}>
            Create Plan
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
//  Main Workouts page
// ═══════════════════════════════════════════
export default function Workouts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const timer = useTimer();
  const [plans, setPlans] = useState(loadPlans);
  const [allExercises, setAllExercises] = useState(loadAndMergeExercises);
  const [currentPlanId, setCurrentPlanId] = useState(loadCurrentPlanId);
  const [activeSession, setActiveSession] = useState(getStoredVisibleActiveWorkoutSession);
  const [elapsed, setElapsed] = useState('');

  // Modals
  const [editingPlanEx, setEditingPlanEx] = useState(null); // { planExIndex }
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [showSessionConflict, setShowSessionConflict] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const startingRef = useRef(false);

  // Current plan
  const currentPlan = plans.find(p => p.id === currentPlanId) || plans[0];

  // Tick elapsed time while session is active
  useEffect(() => {
    if (!activeSession) return;
    const iv = setInterval(() => {
      setElapsed(formatElapsed(activeSession.startedAt));
    }, 1000);
    setElapsed(formatElapsed(activeSession.startedAt));
    return () => clearInterval(iv);
  }, [activeSession]);

  // ── Start session ──
  function claimStartAction() {
    if (startingRef.current) return false;
    startingRef.current = true;
    setIsStarting(true);
    return true;
  }

  function releaseStartAction() {
    startingRef.current = false;
    setIsStarting(false);
  }

  function startCurrentPlan({ alreadyClaimed = false, now = new Date().toISOString() } = {}) {
    if (!currentPlan) {
      if (alreadyClaimed) releaseStartAction();
      return null;
    }
    if (!alreadyClaimed && !claimStartAction()) return null;
    try {
      const session = saveActiveWorkoutSession({
        action: 'start',
        planId: currentPlan.id,
        planName: currentPlan.name,
        now,
      });
      if (!session) {
        releaseStartAction();
        return null;
      }
      pushActiveWorkoutSession(user?.id);
      navigate(`/workout/${currentPlan.id}`);
      return session;
    } catch {
      releaseStartAction();
      return null;
    }
  }

  function handleStart() {
    if (activeSession && activeSession.planId === currentPlan.id) {
      // Already active for this plan — claim once, then navigate to it.
      if (!claimStartAction()) return;
      navigate(`/workout/${currentPlan.id}`);
      return;
    }
    if (activeSession) {
      setShowSessionConflict(true);
      return;
    }
    startCurrentPlan();
  }

  function handleResumeExisting() {
    if (!activeSession || !claimStartAction()) return;
    setShowSessionConflict(false);
    navigate(`/workout/${activeSession.planId}`);
  }

  function handleEndAndStartNew() {
    if (!activeSession || !claimStartAction()) return;
    const endedAt = new Date().toISOString();
    try {
      const endedSession = saveActiveWorkoutSession({ action: 'end', now: endedAt });
      if (!endedSession) {
        releaseStartAction();
        return;
      }
      timer.stopAll();
      pushActiveWorkoutSession(user?.id);
      const replacementTime = Math.max(Date.now(), Date.parse(endedAt) + 1);
      const replacementStartedAt = new Date(replacementTime).toISOString();
      setShowSessionConflict(false);
      startCurrentPlan({ alreadyClaimed: true, now: replacementStartedAt });
    } catch {
      releaseStartAction();
    }
  }

  // ── End session ──
  function handleEndSession() {
    timer.stopAll(); // Stop all timers when workout ends
    saveActiveWorkoutSession({ action: 'end', now: new Date().toISOString() });
    pushActiveWorkoutSession(user?.id);
    setActiveSession(null);
    setElapsed('');
  }

  // ── Switch plan ──
  function handlePlanChange(id) {
    setCurrentPlanId(id);
    saveCurrentPlanId(id);
    setEditMode(false);
    if (user) pushSettings(user.id).catch(reportSyncFailure);
  }

  // ── Create new plan ──
  function handleNewPlan(name) {
    const plan = {
      id: `plan-${Date.now()}`,
      name,
      createdAt: new Date().toISOString(),
      exercises: [],
    };
    const updated = [...plans, plan];
    setPlans(updated);
    savePlans(updated);
    setCurrentPlanId(plan.id);
    saveCurrentPlanId(plan.id);
    setShowNewPlan(false);
    setEditMode(true);
    if (user) pushPlan(plan, user.id).catch(reportSyncFailure);
  }

  // ── Edit exercise prescription ──
  function handleSavePrescription(index, sets, reps, superset) {
    const updated = plans.map(p => {
      if (p.id !== currentPlanId) return p;
      const exs = p.exercises.map((ex, i) =>
        i === index ? { ...ex, prescribedSets: sets, prescribedReps: reps, ...(superset ? { superset } : { superset: undefined }) } : ex
      );
      return { ...p, exercises: exs };
    });
    setPlans(updated);
    savePlans(updated);
    setEditingPlanEx(null);
    const changedPlan = updated.find(p => p.id === currentPlanId);
    if (user && changedPlan) pushPlan(changedPlan, user.id).catch(reportSyncFailure);
  }

  function handleMoveExercise(index, direction) {
    const target = index + direction;
    if (!currentPlan || target < 0 || target >= currentPlan.exercises.length) return;
    const updated = plans.map((plan) => {
      if (plan.id !== currentPlanId) return plan;
      const exercises = [...plan.exercises];
      [exercises[index], exercises[target]] = [exercises[target], exercises[index]];
      return { ...plan, exercises };
    });
    setPlans(updated);
    savePlans(updated);
    const changedPlan = updated.find((plan) => plan.id === currentPlanId);
    if (user && changedPlan) pushPlan(changedPlan, user.id).catch(reportSyncFailure);
  }

  // ── Remove exercise from plan ──
  function handleRemoveExercise(index) {
    const updated = plans.map(p => {
      if (p.id !== currentPlanId) return p;
      return { ...p, exercises: p.exercises.filter((_, i) => i !== index) };
    });
    setPlans(updated);
    savePlans(updated);
    const changedPlan = updated.find(p => p.id === currentPlanId);
    if (user && changedPlan) pushPlan(changedPlan, user.id).catch(reportSyncFailure);
  }

  // ── Add exercise to plan ──
  function handleAddExercise(ex, isNew) {
    // If it's a brand-new exercise, persist it to the global exercises list
    if (isNew) {
      const updatedEx = [...allExercises, ex];
      setAllExercises(updatedEx);
      saveExercises(updatedEx);
      if (user) pushExercise(ex, user.id).catch(reportSyncFailure);
    }

    const planEntry = {
      exerciseId: ex.id,
      prescribedSets: 3,
      prescribedReps: 10,
    };

    const updated = plans.map(p => {
      if (p.id !== currentPlanId) return p;
      return { ...p, exercises: [...p.exercises, planEntry] };
    });
    setPlans(updated);
    savePlans(updated);
    setShowAddExercise(false);
    const changedPlan = updated.find(p => p.id === currentPlanId);
    if (user && changedPlan) pushPlan(changedPlan, user.id).catch(reportSyncFailure);
  }

  // ── Helpers ──
  const getExercise = useCallback(
    (id) => allExercises.find(e => e.id === id),
    [allExercises]
  );

  const planExerciseIds = currentPlan
    ? currentPlan.exercises.map(e => e.exerciseId)
    : [];

  const totalSets = currentPlan
    ? currentPlan.exercises.reduce((sum, e) => sum + e.prescribedSets, 0)
    : 0;

  const isActive =
    activeSession && activeSession.planId === currentPlan?.id;

  return (
    <div className="page">
      <h2 className="page-heading">Workouts</h2>
      <p className="page-sub">Plan your training days</p>

      {/* ── Active session banner ── */}
      {activeSession && (
        <div
          className="active-session-banner"
          onClick={() => navigate(`/workout/${activeSession.planId}`)}
        >
          <div className="active-dot" />
          <div>
            <div className="active-session-banner__title">{activeSession.planName}</div>
            <div className="active-session-banner__meta">
              Session active · {elapsed} · Tap to resume
            </div>
          </div>
          <button className="end-session-btn" onClick={(e) => { e.stopPropagation(); handleEndSession(); }}>
            End
          </button>
        </div>
      )}

      {/* ── Plan picker row ── */}
      <div>
        <div className="workouts-section-title workouts-section-title--compact">Workout Plan</div>
        <div className="plan-picker-row">
          <select
            className="plan-picker-select"
            value={currentPlanId}
            onChange={e => handlePlanChange(e.target.value)}
          >
            {plans.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <button className="new-plan-btn" onClick={() => setShowNewPlan(true)}>
            + New
          </button>
        </div>
      </div>

      {/* ── Plan header card ── */}
      {currentPlan && (
        <div className="plan-header">
          <div className="plan-header__label">Today's Plan</div>
          <div className="plan-header__name">{currentPlan.name}</div>
          <div className="plan-header__meta">
            {currentPlan.exercises.length} exercises · {totalSets} total sets
          </div>
          <div className="plan-header__actions">
            <button
              className={`plan-start-btn${isActive ? ' active' : ''}`}
              onClick={handleStart}
              disabled={isStarting}
              aria-busy={isStarting}
            >
              {isStarting ? 'Starting…' : (isActive ? <><CheckIcon /> In Progress</> : 'Start')}
            </button>
            <button
              className="plan-edit-btn"
              onClick={() => setEditMode(v => !v)}
            >
              {editMode ? <><CheckIcon /> Done</> : 'Edit'}
            </button>
          </div>
        </div>
      )}

      {/* ── Exercise list ── */}
      {currentPlan && currentPlan.exercises.length > 0 && (
        <div>
          <div className="workouts-section-title workouts-section-title--compact">Exercises</div>
          <div className="plan-exercise-list">
            {currentPlan.exercises.map((planEx, i) => {
              const ex = getExercise(planEx.exerciseId);
              if (!ex) return null;
              return (
                <div
                  key={`${planEx.exerciseId}-${i}`}
                  className="plan-exercise-row"
                  onClick={() => setEditingPlanEx(i)}
                >
                  {editMode && (
                    <span className="plan-reorder-controls" aria-label={`Reorder ${ex.name}`}>
                      <button type="button" onClick={(event) => { event.stopPropagation(); handleMoveExercise(i, -1); }} disabled={i === 0} aria-label={`Move ${ex.name} up`}>↑</button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); handleMoveExercise(i, 1); }} disabled={i === currentPlan.exercises.length - 1} aria-label={`Move ${ex.name} down`}>↓</button>
                    </span>
                  )}

                  <div className="plan-exercise-thumb">
                    <MuscleGroupIcon muscleGroup={ex.muscleGroup} />
                  </div>

                  <div className="plan-exercise-info">
                    <div className="plan-exercise-name">{ex.name}</div>
                    <div className="plan-exercise-label">
                      {ex.muscleGroup} · {ex.type}
                    </div>
                  </div>

                  <div className="plan-exercise-prescription">
                    {planEx.prescribedSets}×{planEx.prescribedReps}
                  </div>

                  {editMode && (
                    <button
                      className="plan-exercise-remove"
                      onClick={e => { e.stopPropagation(); handleRemoveExercise(i); }}
                      title="Remove from plan"
                    >
                      x
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Empty plan state ── */}
      {currentPlan && currentPlan.exercises.length === 0 && (
        <p className="workouts-empty">
          No exercises yet. Add some below!
        </p>
      )}

      {/* ── Add exercise button ── */}
      {currentPlan && (
        <button
          className="plan-add-exercise-btn"
          onClick={() => setShowAddExercise(true)}
        >
          <span>＋</span>
          <span>Add Exercise</span>
        </button>
      )}

      {/* ── No plans fallback ── */}
      {!currentPlan && (
        <p className="workouts-empty workouts-empty--tight">
          No plans yet. Create one!
        </p>
      )}

      {/* ════════════ MODALS ════════════ */}

      {/* Edit prescription */}
      {editingPlanEx !== null && currentPlan && (() => {
        const planEx = currentPlan.exercises[editingPlanEx];
        const ex = planEx ? getExercise(planEx.exerciseId) : null;
        return planEx ? (
          <EditExerciseModal
            planEx={planEx}
            exercise={ex}
            onSave={(s, r, superset) => handleSavePrescription(editingPlanEx, s, r, superset)}
            onClose={() => setEditingPlanEx(null)}
          />
        ) : null;
      })()}

      {/* Add exercise */}
      {showAddExercise && (
        <AddExerciseModal
          allExercises={allExercises}
          planExerciseIds={planExerciseIds}
          onAdd={handleAddExercise}
          onClose={() => setShowAddExercise(false)}
        />
      )}

      {/* New plan */}
      {showNewPlan && (
        <NewPlanModal
          onSave={handleNewPlan}
          onClose={() => setShowNewPlan(false)}
        />
      )}

      <Sheet
        open={showSessionConflict}
        onClose={() => {
          if (!startingRef.current) setShowSessionConflict(false);
        }}
        title="Workout already active"
        swipeToDismiss={false}
      >
        <p className="sheet-copy">
          {activeSession?.planName || 'Another workout'} is still active. Resume it, or end it before starting {currentPlan?.name || 'this plan'}.
        </p>
        <div className="sheet-actions">
          <button type="button" className="btn-primary" onClick={handleResumeExisting} disabled={isStarting}>Resume existing</button>
          <button type="button" className="btn-danger" onClick={handleEndAndStartNew} disabled={isStarting} aria-busy={isStarting}>
            {isStarting ? 'Starting…' : 'End & start new'}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setShowSessionConflict(false)} disabled={isStarting}>Cancel</button>
        </div>
      </Sheet>
    </div>
  );
}
