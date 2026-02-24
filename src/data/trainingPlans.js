// src/data/trainingPlans.js — 12 Training Plan Templates
// Based on Greg Doucette's "Harder Than Last Time" taxonomy:
//   Frequency:  Casual (1-day full body), Moderate (2-day upper/lower), Hardcore (3-day push/pull/legs)
//   Duration:   60 min, 90 min
//   Goal:       Hypertrophy (higher reps, TUT focus), Strength (lower reps, explosive)
//
// Each exercise entry:
//   exerciseId   — from exerciseLibrary.js
//   warmupSets   — number of warm-up sets
//   workingSets  — number of working sets
//   targetReps   — string like "8-12" (rep range)
//   intensity    — per-set intensity pattern ['moderate','moderate','hard'] etc.
//   superset     — optional superset group key (exercises with same key are supersetted)
//   notes        — optional coaching cue

// ── Helper: intensity patterns ──────────────────────────────────────────
const I = {
  warmup: 'light',
  ramp:   ['light', 'moderate', 'hard'],
  hyp3:   ['moderate', 'moderate', 'hard'],
  hyp4:   ['moderate', 'moderate', 'hard', 'hard'],
  str3:   ['moderate', 'hard', 'hard'],
  str4:   ['moderate', 'hard', 'hard', 'hard'],
};

const trainingPlans = [
  // ══════════════════════════════════════════════════════════════════════
  // CASUAL — 1 Day Full Body (60 min, Hypertrophy)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'casual-60-hyp',
    name: 'Full Body Hypertrophy (60 min)',
    frequency: 'casual',
    daysPerWeek: 1,
    durationMin: 60,
    goal: 'hypertrophy',
    split: 'full-body',
    days: [
      {
        dayName: 'Full Body',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 2, workingSets: 3, targetReps: '10-15', intensity: I.hyp3, notes: 'Control the eccentric, 2s down' },
          { exerciseId: 'lib-bb-bench',     warmupSets: 1, workingSets: 3, targetReps: '10-15', intensity: I.hyp3, notes: 'Squeeze at the top' },
          { exerciseId: 'lib-lat-pulldown', warmupSets: 1, workingSets: 3, targetReps: '10-15', intensity: I.hyp3, notes: 'Full stretch at top' },
          { exerciseId: 'lib-db-ohp',       warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3, notes: 'Controlled press' },
          { exerciseId: 'lib-db-curl',      warmupSets: 0, workingSets: 2, targetReps: '12-15', intensity: ['moderate', 'hard'], superset: 'A' },
          { exerciseId: 'lib-tri-pushdown', warmupSets: 0, workingSets: 2, targetReps: '12-15', intensity: ['moderate', 'hard'], superset: 'A' },
          { exerciseId: 'lib-plank',        warmupSets: 0, workingSets: 2, targetReps: '30-60s', intensity: ['moderate', 'hard'] },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // CASUAL — 1 Day Full Body (90 min, Hypertrophy)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'casual-90-hyp',
    name: 'Full Body Hypertrophy (90 min)',
    frequency: 'casual',
    daysPerWeek: 1,
    durationMin: 90,
    goal: 'hypertrophy',
    split: 'full-body',
    days: [
      {
        dayName: 'Full Body',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 2, workingSets: 4, targetReps: '10-15', intensity: I.hyp4, notes: 'Control the eccentric, 2s down' },
          { exerciseId: 'lib-rdl',          warmupSets: 1, workingSets: 3, targetReps: '10-12', intensity: I.hyp3, notes: 'Hinge at hips, feel hamstrings' },
          { exerciseId: 'lib-bb-bench',     warmupSets: 1, workingSets: 4, targetReps: '10-15', intensity: I.hyp4, notes: 'Squeeze at the top' },
          { exerciseId: 'lib-bb-row',       warmupSets: 1, workingSets: 3, targetReps: '10-12', intensity: I.hyp3, notes: 'Pull to lower chest' },
          { exerciseId: 'lib-lat-pulldown', warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3, notes: 'Full stretch at top' },
          { exerciseId: 'lib-db-ohp',       warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-lat-raise',    warmupSets: 0, workingSets: 3, targetReps: '12-20', intensity: I.hyp3 },
          { exerciseId: 'lib-db-curl',      warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-tri-pushdown', warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-hanging-leg',  warmupSets: 0, workingSets: 2, targetReps: '10-15', intensity: ['moderate', 'hard'] },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // CASUAL — 1 Day Full Body (60 min, Strength)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'casual-60-str',
    name: 'Full Body Strength (60 min)',
    frequency: 'casual',
    daysPerWeek: 1,
    durationMin: 60,
    goal: 'strength',
    split: 'full-body',
    days: [
      {
        dayName: 'Full Body',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 2, workingSets: 3, targetReps: '5-8',  intensity: I.str3, notes: 'Explosive up, controlled down' },
          { exerciseId: 'lib-bb-bench',     warmupSets: 2, workingSets: 3, targetReps: '5-8',  intensity: I.str3, notes: 'Drive through the chest' },
          { exerciseId: 'lib-bb-row',       warmupSets: 1, workingSets: 3, targetReps: '6-10', intensity: I.str3, notes: 'Brace hard, row to navel' },
          { exerciseId: 'lib-ohp',          warmupSets: 1, workingSets: 3, targetReps: '5-8',  intensity: I.str3 },
          { exerciseId: 'lib-bb-curl',      warmupSets: 0, workingSets: 2, targetReps: '8-10', intensity: ['moderate', 'hard'], superset: 'A' },
          { exerciseId: 'lib-skull-crusher', warmupSets: 0, workingSets: 2, targetReps: '8-10', intensity: ['moderate', 'hard'], superset: 'A' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // CASUAL — 1 Day Full Body (90 min, Strength)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'casual-90-str',
    name: 'Full Body Strength (90 min)',
    frequency: 'casual',
    daysPerWeek: 1,
    durationMin: 90,
    goal: 'strength',
    split: 'full-body',
    days: [
      {
        dayName: 'Full Body',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 3, workingSets: 4, targetReps: '5-8',  intensity: I.str4, notes: 'Explosive up, controlled down' },
          { exerciseId: 'lib-deadlift',     warmupSets: 2, workingSets: 3, targetReps: '5-8',  intensity: I.str3, notes: 'Brace, hinge, lock out' },
          { exerciseId: 'lib-bb-bench',     warmupSets: 2, workingSets: 4, targetReps: '5-8',  intensity: I.str4, notes: 'Drive through the chest' },
          { exerciseId: 'lib-bb-row',       warmupSets: 1, workingSets: 3, targetReps: '6-10', intensity: I.str3 },
          { exerciseId: 'lib-ohp',          warmupSets: 1, workingSets: 3, targetReps: '5-8',  intensity: I.str3 },
          { exerciseId: 'lib-pullups',      warmupSets: 0, workingSets: 3, targetReps: '5-10', intensity: I.str3 },
          { exerciseId: 'lib-bb-curl',      warmupSets: 0, workingSets: 2, targetReps: '8-10', intensity: ['moderate', 'hard'], superset: 'A' },
          { exerciseId: 'lib-close-grip-bp', warmupSets: 0, workingSets: 2, targetReps: '8-10', intensity: ['moderate', 'hard'], superset: 'A' },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // MODERATE — 2 Day Upper/Lower (60 min, Hypertrophy)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'moderate-60-hyp',
    name: 'Upper/Lower Hypertrophy (60 min)',
    frequency: 'moderate',
    daysPerWeek: 2,
    durationMin: 60,
    goal: 'hypertrophy',
    split: 'upper-lower',
    days: [
      {
        dayName: 'Upper Body',
        exercises: [
          { exerciseId: 'lib-bb-bench',     warmupSets: 1, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-lat-pulldown', warmupSets: 1, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-db-ohp',       warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-cable-row',    warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-lat-raise',    warmupSets: 0, workingSets: 3, targetReps: '12-20', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-face-pull',    warmupSets: 0, workingSets: 3, targetReps: '15-20', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-db-curl',      warmupSets: 0, workingSets: 2, targetReps: '12-15', intensity: ['moderate', 'hard'], superset: 'B' },
          { exerciseId: 'lib-tri-rope',     warmupSets: 0, workingSets: 2, targetReps: '12-15', intensity: ['moderate', 'hard'], superset: 'B' },
        ],
      },
      {
        dayName: 'Lower Body',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 2, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-rdl',          warmupSets: 1, workingSets: 3, targetReps: '10-12', intensity: I.hyp3 },
          { exerciseId: 'lib-leg-press',    warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-leg-curl',     warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-leg-ext',      warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-calf-raise',   warmupSets: 0, workingSets: 3, targetReps: '12-20', intensity: I.hyp3 },
          { exerciseId: 'lib-hanging-leg',  warmupSets: 0, workingSets: 2, targetReps: '10-15', intensity: ['moderate', 'hard'] },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // MODERATE — 2 Day Upper/Lower (90 min, Hypertrophy)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'moderate-90-hyp',
    name: 'Upper/Lower Hypertrophy (90 min)',
    frequency: 'moderate',
    daysPerWeek: 2,
    durationMin: 90,
    goal: 'hypertrophy',
    split: 'upper-lower',
    days: [
      {
        dayName: 'Upper Body',
        exercises: [
          { exerciseId: 'lib-bb-bench',     warmupSets: 2, workingSets: 4, targetReps: '10-15', intensity: I.hyp4 },
          { exerciseId: 'lib-bb-row',       warmupSets: 1, workingSets: 4, targetReps: '10-12', intensity: I.hyp4 },
          { exerciseId: 'lib-incline-db',   warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-lat-pulldown', warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-db-ohp',       warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-cable-fly',    warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-lat-raise',    warmupSets: 0, workingSets: 3, targetReps: '12-20', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-face-pull',    warmupSets: 0, workingSets: 3, targetReps: '15-20', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-db-curl',      warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'B' },
          { exerciseId: 'lib-tri-pushdown', warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'B' },
        ],
      },
      {
        dayName: 'Lower Body',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 2, workingSets: 4, targetReps: '10-15', intensity: I.hyp4 },
          { exerciseId: 'lib-rdl',          warmupSets: 1, workingSets: 4, targetReps: '10-12', intensity: I.hyp4 },
          { exerciseId: 'lib-leg-press',    warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-leg-curl',     warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-leg-ext',      warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-hip-thrust',   warmupSets: 1, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-calf-raise',   warmupSets: 0, workingSets: 4, targetReps: '12-20', intensity: I.hyp4 },
          { exerciseId: 'lib-crunch',       warmupSets: 0, workingSets: 3, targetReps: '15-20', intensity: I.hyp3 },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // MODERATE — 2 Day Upper/Lower (60 min, Strength)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'moderate-60-str',
    name: 'Upper/Lower Strength (60 min)',
    frequency: 'moderate',
    daysPerWeek: 2,
    durationMin: 60,
    goal: 'strength',
    split: 'upper-lower',
    days: [
      {
        dayName: 'Upper Body',
        exercises: [
          { exerciseId: 'lib-bb-bench',     warmupSets: 2, workingSets: 3, targetReps: '5-8', intensity: I.str3 },
          { exerciseId: 'lib-bb-row',       warmupSets: 1, workingSets: 3, targetReps: '6-8', intensity: I.str3 },
          { exerciseId: 'lib-ohp',          warmupSets: 1, workingSets: 3, targetReps: '5-8', intensity: I.str3 },
          { exerciseId: 'lib-pullups',      warmupSets: 0, workingSets: 3, targetReps: '5-10', intensity: I.str3 },
          { exerciseId: 'lib-bb-curl',      warmupSets: 0, workingSets: 2, targetReps: '8-10', intensity: ['moderate', 'hard'], superset: 'A' },
          { exerciseId: 'lib-skull-crusher', warmupSets: 0, workingSets: 2, targetReps: '8-10', intensity: ['moderate', 'hard'], superset: 'A' },
        ],
      },
      {
        dayName: 'Lower Body',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 2, workingSets: 3, targetReps: '5-8',  intensity: I.str3 },
          { exerciseId: 'lib-deadlift',     warmupSets: 2, workingSets: 3, targetReps: '5-8',  intensity: I.str3 },
          { exerciseId: 'lib-leg-press',    warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3 },
          { exerciseId: 'lib-leg-curl',     warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3 },
          { exerciseId: 'lib-calf-raise',   warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.str3 },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // MODERATE — 2 Day Upper/Lower (90 min, Strength)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'moderate-90-str',
    name: 'Upper/Lower Strength (90 min)',
    frequency: 'moderate',
    daysPerWeek: 2,
    durationMin: 90,
    goal: 'strength',
    split: 'upper-lower',
    days: [
      {
        dayName: 'Upper Body',
        exercises: [
          { exerciseId: 'lib-bb-bench',     warmupSets: 3, workingSets: 4, targetReps: '5-8',  intensity: I.str4 },
          { exerciseId: 'lib-bb-row',       warmupSets: 2, workingSets: 4, targetReps: '5-8',  intensity: I.str4 },
          { exerciseId: 'lib-ohp',          warmupSets: 1, workingSets: 3, targetReps: '5-8',  intensity: I.str3 },
          { exerciseId: 'lib-pullups',      warmupSets: 0, workingSets: 3, targetReps: '5-10', intensity: I.str3 },
          { exerciseId: 'lib-incline-db',   warmupSets: 0, workingSets: 3, targetReps: '6-10', intensity: I.str3 },
          { exerciseId: 'lib-face-pull',    warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-bb-curl',      warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3, superset: 'A' },
          { exerciseId: 'lib-close-grip-bp', warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3, superset: 'A' },
        ],
      },
      {
        dayName: 'Lower Body',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 3, workingSets: 4, targetReps: '5-8',  intensity: I.str4 },
          { exerciseId: 'lib-deadlift',     warmupSets: 2, workingSets: 4, targetReps: '5-8',  intensity: I.str4 },
          { exerciseId: 'lib-front-squat',  warmupSets: 1, workingSets: 3, targetReps: '6-8',  intensity: I.str3 },
          { exerciseId: 'lib-rdl',          warmupSets: 0, workingSets: 3, targetReps: '6-10', intensity: I.str3 },
          { exerciseId: 'lib-leg-curl',     warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3 },
          { exerciseId: 'lib-calf-raise',   warmupSets: 0, workingSets: 4, targetReps: '10-15', intensity: I.str4 },
          { exerciseId: 'lib-hanging-leg',  warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // HARDCORE — 3 Day Push/Pull/Legs (60 min, Hypertrophy)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'hardcore-60-hyp',
    name: 'Push/Pull/Legs Hypertrophy (60 min)',
    frequency: 'hardcore',
    daysPerWeek: 3,
    durationMin: 60,
    goal: 'hypertrophy',
    split: 'push-pull-legs',
    days: [
      {
        dayName: 'Push (Chest, Shoulders, Triceps)',
        exercises: [
          { exerciseId: 'lib-bb-bench',     warmupSets: 2, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-incline-db',   warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-db-ohp',       warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-cable-fly',    warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-lat-raise',    warmupSets: 0, workingSets: 3, targetReps: '12-20', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-tri-pushdown', warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
        ],
      },
      {
        dayName: 'Pull (Back, Biceps)',
        exercises: [
          { exerciseId: 'lib-lat-pulldown', warmupSets: 1, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-bb-row',       warmupSets: 1, workingSets: 3, targetReps: '10-12', intensity: I.hyp3 },
          { exerciseId: 'lib-cable-row',    warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-face-pull',    warmupSets: 0, workingSets: 3, targetReps: '15-20', intensity: I.hyp3, superset: 'B' },
          { exerciseId: 'lib-rear-delt-fly', warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'B' },
          { exerciseId: 'lib-db-curl',      warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
        ],
      },
      {
        dayName: 'Legs',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 2, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-rdl',          warmupSets: 1, workingSets: 3, targetReps: '10-12', intensity: I.hyp3 },
          { exerciseId: 'lib-leg-press',    warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-leg-curl',     warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-leg-ext',      warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-calf-raise',   warmupSets: 0, workingSets: 3, targetReps: '12-20', intensity: I.hyp3 },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // HARDCORE — 3 Day Push/Pull/Legs (90 min, Hypertrophy)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'hardcore-90-hyp',
    name: 'Push/Pull/Legs Hypertrophy (90 min)',
    frequency: 'hardcore',
    daysPerWeek: 3,
    durationMin: 90,
    goal: 'hypertrophy',
    split: 'push-pull-legs',
    days: [
      {
        dayName: 'Push (Chest, Shoulders, Triceps)',
        exercises: [
          { exerciseId: 'lib-bb-bench',     warmupSets: 2, workingSets: 4, targetReps: '10-15', intensity: I.hyp4 },
          { exerciseId: 'lib-incline-db',   warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-db-ohp',       warmupSets: 0, workingSets: 4, targetReps: '10-15', intensity: I.hyp4 },
          { exerciseId: 'lib-cable-fly',    warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-lat-raise',    warmupSets: 0, workingSets: 4, targetReps: '12-20', intensity: I.hyp4 },
          { exerciseId: 'lib-front-raise',  warmupSets: 0, workingSets: 2, targetReps: '12-15', intensity: ['moderate', 'hard'] },
          { exerciseId: 'lib-tri-pushdown', warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'A' },
          { exerciseId: 'lib-db-overhead-ext', warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'A' },
        ],
      },
      {
        dayName: 'Pull (Back, Biceps, Rear Delts)',
        exercises: [
          { exerciseId: 'lib-lat-pulldown', warmupSets: 1, workingSets: 4, targetReps: '10-15', intensity: I.hyp4 },
          { exerciseId: 'lib-bb-row',       warmupSets: 1, workingSets: 4, targetReps: '10-12', intensity: I.hyp4 },
          { exerciseId: 'lib-cable-row',    warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-straight-arm-pd', warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-face-pull',    warmupSets: 0, workingSets: 3, targetReps: '15-20', intensity: I.hyp3 },
          { exerciseId: 'lib-db-curl',      warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'B' },
          { exerciseId: 'lib-hammer-curl',  warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3, superset: 'B' },
        ],
      },
      {
        dayName: 'Legs',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 2, workingSets: 4, targetReps: '10-15', intensity: I.hyp4 },
          { exerciseId: 'lib-rdl',          warmupSets: 1, workingSets: 4, targetReps: '10-12', intensity: I.hyp4 },
          { exerciseId: 'lib-leg-press',    warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-leg-curl',     warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-leg-ext',      warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-hip-thrust',   warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-calf-raise',   warmupSets: 0, workingSets: 4, targetReps: '12-20', intensity: I.hyp4 },
          { exerciseId: 'lib-hanging-leg',  warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // HARDCORE — 3 Day Push/Pull/Legs (60 min, Strength)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'hardcore-60-str',
    name: 'Push/Pull/Legs Strength (60 min)',
    frequency: 'hardcore',
    daysPerWeek: 3,
    durationMin: 60,
    goal: 'strength',
    split: 'push-pull-legs',
    days: [
      {
        dayName: 'Push',
        exercises: [
          { exerciseId: 'lib-bb-bench',     warmupSets: 2, workingSets: 3, targetReps: '5-8',  intensity: I.str3 },
          { exerciseId: 'lib-ohp',          warmupSets: 1, workingSets: 3, targetReps: '5-8',  intensity: I.str3 },
          { exerciseId: 'lib-incline-db',   warmupSets: 0, workingSets: 3, targetReps: '6-10', intensity: I.str3 },
          { exerciseId: 'lib-lat-raise',    warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
          { exerciseId: 'lib-tri-pushdown', warmupSets: 0, workingSets: 3, targetReps: '8-12', intensity: I.str3 },
        ],
      },
      {
        dayName: 'Pull',
        exercises: [
          { exerciseId: 'lib-deadlift',     warmupSets: 2, workingSets: 3, targetReps: '5-8',  intensity: I.str3 },
          { exerciseId: 'lib-pullups',      warmupSets: 0, workingSets: 3, targetReps: '5-10', intensity: I.str3 },
          { exerciseId: 'lib-bb-row',       warmupSets: 1, workingSets: 3, targetReps: '6-8',  intensity: I.str3 },
          { exerciseId: 'lib-face-pull',    warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-bb-curl',      warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3 },
        ],
      },
      {
        dayName: 'Legs',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 2, workingSets: 3, targetReps: '5-8',  intensity: I.str3 },
          { exerciseId: 'lib-rdl',          warmupSets: 1, workingSets: 3, targetReps: '6-8',  intensity: I.str3 },
          { exerciseId: 'lib-leg-press',    warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3 },
          { exerciseId: 'lib-leg-curl',     warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3 },
          { exerciseId: 'lib-calf-raise',   warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.str3 },
        ],
      },
    ],
  },

  // ══════════════════════════════════════════════════════════════════════
  // HARDCORE — 3 Day Push/Pull/Legs (90 min, Strength)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'hardcore-90-str',
    name: 'Push/Pull/Legs Strength (90 min)',
    frequency: 'hardcore',
    daysPerWeek: 3,
    durationMin: 90,
    goal: 'strength',
    split: 'push-pull-legs',
    days: [
      {
        dayName: 'Push',
        exercises: [
          { exerciseId: 'lib-bb-bench',     warmupSets: 3, workingSets: 4, targetReps: '5-8',  intensity: I.str4 },
          { exerciseId: 'lib-ohp',          warmupSets: 2, workingSets: 4, targetReps: '5-8',  intensity: I.str4 },
          { exerciseId: 'lib-incline-db',   warmupSets: 0, workingSets: 3, targetReps: '6-10', intensity: I.str3 },
          { exerciseId: 'lib-cable-fly',    warmupSets: 0, workingSets: 3, targetReps: '10-12', intensity: I.hyp3 },
          { exerciseId: 'lib-lat-raise',    warmupSets: 0, workingSets: 4, targetReps: '10-15', intensity: I.hyp4 },
          { exerciseId: 'lib-tri-pushdown', warmupSets: 0, workingSets: 3, targetReps: '8-12', intensity: I.str3, superset: 'A' },
          { exerciseId: 'lib-skull-crusher', warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3, superset: 'A' },
        ],
      },
      {
        dayName: 'Pull',
        exercises: [
          { exerciseId: 'lib-deadlift',     warmupSets: 3, workingSets: 4, targetReps: '5-8',  intensity: I.str4 },
          { exerciseId: 'lib-pullups',      warmupSets: 0, workingSets: 4, targetReps: '5-10', intensity: I.str4 },
          { exerciseId: 'lib-bb-row',       warmupSets: 1, workingSets: 4, targetReps: '5-8',  intensity: I.str4 },
          { exerciseId: 'lib-cable-row',    warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3 },
          { exerciseId: 'lib-face-pull',    warmupSets: 0, workingSets: 3, targetReps: '12-15', intensity: I.hyp3 },
          { exerciseId: 'lib-bb-curl',      warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3, superset: 'B' },
          { exerciseId: 'lib-hammer-curl',  warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3, superset: 'B' },
        ],
      },
      {
        dayName: 'Legs',
        exercises: [
          { exerciseId: 'lib-bb-squat',     warmupSets: 3, workingSets: 4, targetReps: '5-8',  intensity: I.str4 },
          { exerciseId: 'lib-front-squat',  warmupSets: 1, workingSets: 3, targetReps: '6-8',  intensity: I.str3 },
          { exerciseId: 'lib-rdl',          warmupSets: 1, workingSets: 4, targetReps: '5-8',  intensity: I.str4 },
          { exerciseId: 'lib-leg-press',    warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3 },
          { exerciseId: 'lib-leg-curl',     warmupSets: 0, workingSets: 3, targetReps: '8-10', intensity: I.str3 },
          { exerciseId: 'lib-calf-raise',   warmupSets: 0, workingSets: 4, targetReps: '10-15', intensity: I.str4 },
          { exerciseId: 'lib-hanging-leg',  warmupSets: 0, workingSets: 3, targetReps: '10-15', intensity: I.hyp3 },
        ],
      },
    ],
  },
];

// ── Helpers ─────────────────────────────────────────────────────────────
export function getPlanById(id) {
  return trainingPlans.find(p => p.id === id) || null;
}

export function getPlansForProfile({ daysPerWeek, durationMin, goal }) {
  return trainingPlans.filter(p =>
    p.daysPerWeek <= daysPerWeek &&
    p.durationMin <= durationMin &&
    p.goal === goal
  );
}

export function recommendPlan({ daysPerWeek, durationMin, goal }) {
  // Pick the closest match: prioritize matching days, then duration
  const candidates = trainingPlans.filter(p => p.goal === goal);
  // Sort by closest daysPerWeek match, then closest duration
  candidates.sort((a, b) => {
    const daDiff = Math.abs(a.daysPerWeek - daysPerWeek);
    const dbDiff = Math.abs(b.daysPerWeek - daysPerWeek);
    if (daDiff !== dbDiff) return daDiff - dbDiff;
    const taDiff = Math.abs(a.durationMin - durationMin);
    const tbDiff = Math.abs(b.durationMin - durationMin);
    return taDiff - tbDiff;
  });
  return candidates[0] || trainingPlans[0];
}

export default trainingPlans;
