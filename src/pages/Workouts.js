import React, { useState, useEffect, useCallback } from 'react';
import './Page.css';
import './Workouts.css';

// ── Muscle-group emoji map ──
const GROUP_EMOJI = {
  Chest:     '🏋️',
  Back:      '🔙',
  Legs:      '🦵',
  Shoulders: '🙆',
  Arms:      '💪',
  Core:      '🧘',
  default:   '⚡',
};

function thumbEmoji(muscleGroup) {
  return GROUP_EMOJI[muscleGroup] || GROUP_EMOJI.default;
}

// ── Seed plans ──
const SEED_PLAN_ID = 'legs-biceps-day';
const SEED_PLAN_UB_ID = 'upper-body-day';

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

function loadActiveSession() {
  try {
    const raw = localStorage.getItem('activeWorkoutSession');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveActiveSession(session) {
  if (session) {
    localStorage.setItem('activeWorkoutSession', JSON.stringify(session));
  } else {
    localStorage.removeItem('activeWorkoutSession');
  }
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
  const secs = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
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

  function handleSave() {
    const s = Math.max(1, parseInt(sets, 10) || 1);
    const r = Math.max(1, parseInt(reps, 10) || 1);
    onSave(s, r);
  }

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={e => e.stopPropagation()}>
        <div>
          <h3 className="workout-modal__title">{exercise?.name || 'Exercise'}</h3>
          <p className="workout-modal__sub">{exercise?.muscleGroup} · Edit prescription</p>
        </div>

        <div className="prescription-editor">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'end' }}>
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
    if (!name) return;
    const newEx = {
      id: `ex-${Date.now()}`,
      name,
      muscleGroup: 'Legs',
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
                className="exercise-search-row"
                onClick={() => !alreadyIn && handlePickExercise(ex)}
                style={alreadyIn ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
              >
                <span style={{ fontSize: 20 }}>{thumbEmoji(ex.muscleGroup)}</span>
                <span className="exercise-search-name">{ex.name}</span>
                <span className="exercise-search-meta">{ex.muscleGroup}</span>
                {alreadyIn && <span style={{ fontSize: 11, color: '#9999b3' }}>Added</span>}
              </div>
            );
          })}

          {showCreateNew && (
            <div className="exercise-search-row create-new" onClick={handleCreateNew}>
              + Create "{query}"
            </div>
          )}

          {filtered.length === 0 && !showCreateNew && (
            <p style={{ color: '#9999b3', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
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
  const [plans, setPlans] = useState(loadPlans);
  const [allExercises, setAllExercises] = useState(loadAndMergeExercises);
  const [currentPlanId, setCurrentPlanId] = useState(loadCurrentPlanId);
  const [activeSession, setActiveSession] = useState(loadActiveSession);
  const [elapsed, setElapsed] = useState('');

  // Modals
  const [editingPlanEx, setEditingPlanEx] = useState(null); // { planExIndex }
  const [showAddExercise, setShowAddExercise] = useState(false);
  const [showNewPlan, setShowNewPlan] = useState(false);
  const [editMode, setEditMode] = useState(false);

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
  function handleStart() {
    if (activeSession) return; // already active
    const session = {
      planId: currentPlan.id,
      planName: currentPlan.name,
      startedAt: new Date().toISOString(),
    };
    setActiveSession(session);
    saveActiveSession(session);
  }

  // ── End session ──
  function handleEndSession() {
    setActiveSession(null);
    saveActiveSession(null);
    setElapsed('');
  }

  // ── Switch plan ──
  function handlePlanChange(id) {
    setCurrentPlanId(id);
    saveCurrentPlanId(id);
    setEditMode(false);
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
  }

  // ── Edit exercise prescription ──
  function handleSavePrescription(index, sets, reps) {
    const updated = plans.map(p => {
      if (p.id !== currentPlanId) return p;
      const exs = p.exercises.map((ex, i) =>
        i === index ? { ...ex, prescribedSets: sets, prescribedReps: reps } : ex
      );
      return { ...p, exercises: exs };
    });
    setPlans(updated);
    savePlans(updated);
    setEditingPlanEx(null);
  }

  // ── Remove exercise from plan ──
  function handleRemoveExercise(index) {
    const updated = plans.map(p => {
      if (p.id !== currentPlanId) return p;
      return { ...p, exercises: p.exercises.filter((_, i) => i !== index) };
    });
    setPlans(updated);
    savePlans(updated);
  }

  // ── Add exercise to plan ──
  function handleAddExercise(ex, isNew) {
    // If it's a brand-new exercise, persist it to the global exercises list
    if (isNew) {
      const updatedEx = [...allExercises, ex];
      setAllExercises(updatedEx);
      saveExercises(updatedEx);
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
        <div className="active-session-banner">
          <div className="active-dot" />
          <div>
            <div style={{ fontWeight: 800 }}>{activeSession.planName}</div>
            <div style={{ fontSize: 12, fontWeight: 500, opacity: 0.85 }}>
              Session active · {elapsed}
            </div>
          </div>
          <button className="end-session-btn" onClick={handleEndSession}>
            End
          </button>
        </div>
      )}

      {/* ── Plan picker row ── */}
      <div>
        <div className="workouts-section-title" style={{ marginBottom: 6 }}>Workout Plan</div>
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
              disabled={!!activeSession}
            >
              {isActive ? '🟢 In Progress' : '▶ Start'}
            </button>
            <button
              className="plan-edit-btn"
              onClick={() => setEditMode(v => !v)}
            >
              {editMode ? '✓ Done' : '✏️ Edit'}
            </button>
          </div>
        </div>
      )}

      {/* ── Exercise list ── */}
      {currentPlan && currentPlan.exercises.length > 0 && (
        <div>
          <div className="workouts-section-title" style={{ marginBottom: 6 }}>Exercises</div>
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
                    <span className="plan-drag-handle">⋮⋮</span>
                  )}

                  <div className="plan-exercise-thumb">
                    {thumbEmoji(ex.muscleGroup)}
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
                      style={{ opacity: 1 }}
                    >
                      ✕
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
        <p style={{ color: '#9999b3', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
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
        <p style={{ color: '#9999b3', fontSize: 14, textAlign: 'center' }}>
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
            onSave={(s, r) => handleSavePrescription(editingPlanEx, s, r)}
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
    </div>
  );
}
