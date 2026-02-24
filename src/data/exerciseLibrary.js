// src/data/exerciseLibrary.js — Comprehensive exercise database
// Organized by muscle group with alternatives, equipment tags, compound/isolation classification.
// Based on Greg Doucette's "Harder Than Last Time" exercise appendix.

const exerciseLibrary = [
  // ── CHEST ──────────────────────────────────────────────────────────────
  { id: 'lib-bb-bench',      name: 'Barbell Bench Press',       muscleGroup: 'Chest',     type: 'Strength', category: 'compound',  equipment: ['barbell', 'bench'],       alternatives: ['lib-db-bench', 'lib-machine-chest'] },
  { id: 'lib-db-bench',      name: 'Dumbbell Bench Press',      muscleGroup: 'Chest',     type: 'Strength', category: 'compound',  equipment: ['dumbbell', 'bench'],      alternatives: ['lib-bb-bench', 'lib-machine-chest'] },
  { id: 'lib-incline-bb',    name: 'Incline Barbell Press',     muscleGroup: 'Chest',     type: 'Strength', category: 'compound',  equipment: ['barbell', 'bench'],       alternatives: ['lib-incline-db', 'lib-smith-incline'] },
  { id: 'lib-incline-db',    name: 'Incline Dumbbell Press',    muscleGroup: 'Chest',     type: 'Strength', category: 'compound',  equipment: ['dumbbell', 'bench'],      alternatives: ['lib-incline-bb'] },
  { id: 'lib-smith-incline', name: 'Smith Machine Incline Press', muscleGroup: 'Chest',   type: 'Strength', category: 'compound',  equipment: ['smith'],                  alternatives: ['lib-incline-bb', 'lib-incline-db'] },
  { id: 'lib-cable-fly',     name: 'Cable Fly',                 muscleGroup: 'Chest',     type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-db-fly', 'lib-pec-deck'] },
  { id: 'lib-db-fly',        name: 'Dumbbell Fly',              muscleGroup: 'Chest',     type: 'Strength', category: 'isolation', equipment: ['dumbbell', 'bench'],      alternatives: ['lib-cable-fly', 'lib-pec-deck'] },
  { id: 'lib-pec-deck',      name: 'Pec Deck Machine',          muscleGroup: 'Chest',     type: 'Strength', category: 'isolation', equipment: ['machine'],                alternatives: ['lib-cable-fly', 'lib-db-fly'] },
  { id: 'lib-machine-chest',  name: 'Machine Chest Press',      muscleGroup: 'Chest',     type: 'Strength', category: 'compound',  equipment: ['machine'],                alternatives: ['lib-bb-bench', 'lib-db-bench'] },
  { id: 'lib-dips-chest',    name: 'Chest Dips',                muscleGroup: 'Chest',     type: 'Strength', category: 'compound',  equipment: ['bodyweight'],             alternatives: ['lib-bb-bench', 'lib-push-ups'] },
  { id: 'lib-push-ups',      name: 'Push-Ups',                  muscleGroup: 'Chest',     type: 'Strength', category: 'compound',  equipment: ['bodyweight'],             alternatives: ['lib-dips-chest', 'lib-db-bench'] },

  // ── BACK ───────────────────────────────────────────────────────────────
  { id: 'lib-bb-row',        name: 'Barbell Row',               muscleGroup: 'Back',      type: 'Strength', category: 'compound',  equipment: ['barbell'],                alternatives: ['lib-db-row', 'lib-cable-row'] },
  { id: 'lib-db-row',        name: 'Dumbbell Row',              muscleGroup: 'Back',      type: 'Strength', category: 'compound',  equipment: ['dumbbell'],               alternatives: ['lib-bb-row', 'lib-cable-row'] },
  { id: 'lib-cable-row',     name: 'Seated Cable Row',          muscleGroup: 'Back',      type: 'Strength', category: 'compound',  equipment: ['cable'],                  alternatives: ['lib-bb-row', 'lib-machine-row'] },
  { id: 'lib-machine-row',   name: 'Machine Row',               muscleGroup: 'Back',      type: 'Strength', category: 'compound',  equipment: ['machine'],                alternatives: ['lib-cable-row', 'lib-db-row'] },
  { id: 'lib-pullups',       name: 'Pull-Ups',                  muscleGroup: 'Back',      type: 'Strength', category: 'compound',  equipment: ['bodyweight'],             alternatives: ['lib-lat-pulldown', 'lib-chinups'] },
  { id: 'lib-chinups',       name: 'Chin-Ups',                  muscleGroup: 'Back',      type: 'Strength', category: 'compound',  equipment: ['bodyweight'],             alternatives: ['lib-pullups', 'lib-lat-pulldown'] },
  { id: 'lib-lat-pulldown',  name: 'Lat Pulldown',              muscleGroup: 'Back',      type: 'Strength', category: 'compound',  equipment: ['cable'],                  alternatives: ['lib-pullups', 'lib-chinups'] },
  { id: 'lib-deadlift',      name: 'Deadlift',                  muscleGroup: 'Back',      type: 'Strength', category: 'compound',  equipment: ['barbell'],                alternatives: ['lib-rdl', 'lib-rack-pull'] },
  { id: 'lib-rack-pull',     name: 'Rack Pull',                 muscleGroup: 'Back',      type: 'Strength', category: 'compound',  equipment: ['barbell'],                alternatives: ['lib-deadlift'] },
  { id: 'lib-tbar-row',      name: 'T-Bar Row',                 muscleGroup: 'Back',      type: 'Strength', category: 'compound',  equipment: ['barbell'],                alternatives: ['lib-bb-row', 'lib-machine-row'] },
  { id: 'lib-face-pull',     name: 'Face Pull',                 muscleGroup: 'Back',      type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-band-pull-apart'] },
  { id: 'lib-band-pull-apart', name: 'Band Pull-Apart',         muscleGroup: 'Back',      type: 'Strength', category: 'isolation', equipment: ['band'],                   alternatives: ['lib-face-pull'] },
  { id: 'lib-straight-arm-pd', name: 'Straight-Arm Pulldown',   muscleGroup: 'Back',      type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-lat-pulldown'] },

  // ── LEGS ───────────────────────────────────────────────────────────────
  { id: 'lib-bb-squat',      name: 'Barbell Squat',             muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['barbell'],                alternatives: ['lib-hack-squat', 'lib-leg-press'] },
  { id: 'lib-hack-squat',    name: 'Hack Squat',                muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['machine'],                alternatives: ['lib-bb-squat', 'lib-leg-press'] },
  { id: 'lib-leg-press',     name: 'Leg Press',                 muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['machine'],                alternatives: ['lib-bb-squat', 'lib-hack-squat'] },
  { id: 'lib-front-squat',   name: 'Front Squat',               muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['barbell'],                alternatives: ['lib-bb-squat', 'lib-goblet-squat'] },
  { id: 'lib-goblet-squat',  name: 'Goblet Squat',              muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['dumbbell'],               alternatives: ['lib-front-squat', 'lib-bb-squat'] },
  { id: 'lib-rdl',           name: 'Romanian Deadlift',         muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['barbell'],                alternatives: ['lib-db-rdl', 'lib-stiff-leg-dl'] },
  { id: 'lib-db-rdl',        name: 'Dumbbell RDL',              muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['dumbbell'],               alternatives: ['lib-rdl'] },
  { id: 'lib-stiff-leg-dl',  name: 'Stiff-Leg Deadlift',       muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['barbell'],                alternatives: ['lib-rdl'] },
  { id: 'lib-leg-ext',       name: 'Leg Extension',             muscleGroup: 'Legs',      type: 'Strength', category: 'isolation', equipment: ['machine'],                alternatives: ['lib-sissy-squat'] },
  { id: 'lib-leg-curl',      name: 'Leg Curl',                  muscleGroup: 'Legs',      type: 'Strength', category: 'isolation', equipment: ['machine'],                alternatives: ['lib-nordic-curl'] },
  { id: 'lib-nordic-curl',   name: 'Nordic Hamstring Curl',     muscleGroup: 'Legs',      type: 'Strength', category: 'isolation', equipment: ['bodyweight'],             alternatives: ['lib-leg-curl'] },
  { id: 'lib-sissy-squat',   name: 'Sissy Squat',               muscleGroup: 'Legs',      type: 'Strength', category: 'isolation', equipment: ['bodyweight'],             alternatives: ['lib-leg-ext'] },
  { id: 'lib-lunges',        name: 'Walking Lunges',            muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['dumbbell'],               alternatives: ['lib-bw-lunges', 'lib-split-squat'] },
  { id: 'lib-bw-lunges',     name: 'Bodyweight Lunges',         muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['bodyweight'],             alternatives: ['lib-lunges'] },
  { id: 'lib-split-squat',   name: 'Bulgarian Split Squat',     muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['dumbbell'],               alternatives: ['lib-lunges'] },
  { id: 'lib-calf-raise',    name: 'Standing Calf Raise',       muscleGroup: 'Legs',      type: 'Strength', category: 'isolation', equipment: ['machine'],                alternatives: ['lib-seated-calf'] },
  { id: 'lib-seated-calf',   name: 'Seated Calf Raise',         muscleGroup: 'Legs',      type: 'Strength', category: 'isolation', equipment: ['machine'],                alternatives: ['lib-calf-raise'] },
  { id: 'lib-hip-thrust',    name: 'Hip Thrust',                muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['barbell', 'bench'],       alternatives: ['lib-glute-bridge'] },
  { id: 'lib-glute-bridge',  name: 'Glute Bridge',              muscleGroup: 'Legs',      type: 'Strength', category: 'compound',  equipment: ['bodyweight'],             alternatives: ['lib-hip-thrust'] },

  // ── SHOULDERS ──────────────────────────────────────────────────────────
  { id: 'lib-ohp',           name: 'Overhead Press',            muscleGroup: 'Shoulders', type: 'Strength', category: 'compound',  equipment: ['barbell'],                alternatives: ['lib-db-ohp', 'lib-machine-ohp'] },
  { id: 'lib-db-ohp',        name: 'Dumbbell Shoulder Press',   muscleGroup: 'Shoulders', type: 'Strength', category: 'compound',  equipment: ['dumbbell'],               alternatives: ['lib-ohp', 'lib-machine-ohp'] },
  { id: 'lib-machine-ohp',   name: 'Machine Shoulder Press',    muscleGroup: 'Shoulders', type: 'Strength', category: 'compound',  equipment: ['machine'],                alternatives: ['lib-ohp', 'lib-db-ohp'] },
  { id: 'lib-lat-raise',     name: 'Lateral Raise',             muscleGroup: 'Shoulders', type: 'Strength', category: 'isolation', equipment: ['dumbbell'],               alternatives: ['lib-cable-lat-raise', 'lib-machine-lat-raise'] },
  { id: 'lib-cable-lat-raise', name: 'Cable Lateral Raise',     muscleGroup: 'Shoulders', type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-lat-raise'] },
  { id: 'lib-machine-lat-raise', name: 'Machine Lateral Raise', muscleGroup: 'Shoulders', type: 'Strength', category: 'isolation', equipment: ['machine'],                alternatives: ['lib-lat-raise'] },
  { id: 'lib-front-raise',   name: 'Front Raise',               muscleGroup: 'Shoulders', type: 'Strength', category: 'isolation', equipment: ['dumbbell'],               alternatives: ['lib-cable-front-raise'] },
  { id: 'lib-cable-front-raise', name: 'Cable Front Raise',     muscleGroup: 'Shoulders', type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-front-raise'] },
  { id: 'lib-rear-delt-fly',  name: 'Rear Delt Fly',            muscleGroup: 'Shoulders', type: 'Strength', category: 'isolation', equipment: ['dumbbell'],               alternatives: ['lib-face-pull', 'lib-reverse-pec-deck'] },
  { id: 'lib-reverse-pec-deck', name: 'Reverse Pec Deck',      muscleGroup: 'Shoulders', type: 'Strength', category: 'isolation', equipment: ['machine'],                alternatives: ['lib-rear-delt-fly', 'lib-face-pull'] },
  { id: 'lib-arnold-press',  name: 'Arnold Press',              muscleGroup: 'Shoulders', type: 'Strength', category: 'compound',  equipment: ['dumbbell'],               alternatives: ['lib-db-ohp'] },
  { id: 'lib-pike-pushup',   name: 'Pike Push-Up',              muscleGroup: 'Shoulders', type: 'Strength', category: 'compound',  equipment: ['bodyweight'],             alternatives: ['lib-ohp', 'lib-db-ohp'] },

  // ── ARMS (Biceps) ─────────────────────────────────────────────────────
  { id: 'lib-bb-curl',       name: 'Barbell Curl',              muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['barbell'],                alternatives: ['lib-db-curl', 'lib-ez-curl'] },
  { id: 'lib-db-curl',       name: 'Dumbbell Curl',             muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['dumbbell'],               alternatives: ['lib-bb-curl', 'lib-cable-curl'] },
  { id: 'lib-ez-curl',       name: 'EZ-Bar Curl',              muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['barbell'],                alternatives: ['lib-bb-curl'] },
  { id: 'lib-cable-curl',    name: 'Cable Curl',                muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-bb-curl', 'lib-db-curl'] },
  { id: 'lib-hammer-curl',   name: 'Hammer Curl',               muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['dumbbell'],               alternatives: ['lib-db-curl'] },
  { id: 'lib-preacher-curl', name: 'Preacher Curl',             muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['barbell', 'bench'],       alternatives: ['lib-machine-curl'] },
  { id: 'lib-machine-curl',  name: 'Machine Curl',              muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['machine'],                alternatives: ['lib-preacher-curl'] },
  { id: 'lib-incline-curl',  name: 'Incline Dumbbell Curl',     muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['dumbbell', 'bench'],      alternatives: ['lib-db-curl'] },
  { id: 'lib-conc-curl',     name: 'Concentration Curl',        muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['dumbbell'],               alternatives: ['lib-db-curl'] },

  // ── ARMS (Triceps) ────────────────────────────────────────────────────
  { id: 'lib-tri-pushdown',  name: 'Tricep Pushdown',           muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-tri-rope', 'lib-tri-dip'] },
  { id: 'lib-tri-rope',      name: 'Rope Pushdown',             muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-tri-pushdown'] },
  { id: 'lib-tri-dip',       name: 'Tricep Dips',               muscleGroup: 'Arms',      type: 'Strength', category: 'compound',  equipment: ['bodyweight'],             alternatives: ['lib-tri-pushdown', 'lib-bench-dip'] },
  { id: 'lib-bench-dip',     name: 'Bench Dip',                 muscleGroup: 'Arms',      type: 'Strength', category: 'compound',  equipment: ['bench'],                  alternatives: ['lib-tri-dip'] },
  { id: 'lib-skull-crusher', name: 'Skull Crusher',             muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['barbell', 'bench'],       alternatives: ['lib-db-overhead-ext'] },
  { id: 'lib-db-overhead-ext', name: 'DB Overhead Extension',   muscleGroup: 'Arms',      type: 'Strength', category: 'isolation', equipment: ['dumbbell'],               alternatives: ['lib-skull-crusher', 'lib-cable-overhead-ext'] },
  { id: 'lib-cable-overhead-ext', name: 'Cable Overhead Extension', muscleGroup: 'Arms',  type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-db-overhead-ext'] },
  { id: 'lib-close-grip-bp', name: 'Close-Grip Bench Press',    muscleGroup: 'Arms',      type: 'Strength', category: 'compound',  equipment: ['barbell', 'bench'],       alternatives: ['lib-tri-dip'] },
  { id: 'lib-diamond-pushup', name: 'Diamond Push-Up',          muscleGroup: 'Arms',      type: 'Strength', category: 'compound',  equipment: ['bodyweight'],             alternatives: ['lib-tri-dip', 'lib-bench-dip'] },

  // ── CORE ───────────────────────────────────────────────────────────────
  { id: 'lib-plank',         name: 'Plank',                     muscleGroup: 'Core',      type: 'Strength', category: 'isolation', equipment: ['bodyweight'],             alternatives: ['lib-dead-bug'] },
  { id: 'lib-dead-bug',      name: 'Dead Bug',                  muscleGroup: 'Core',      type: 'Strength', category: 'isolation', equipment: ['bodyweight'],             alternatives: ['lib-plank'] },
  { id: 'lib-crunch',        name: 'Crunch',                    muscleGroup: 'Core',      type: 'Strength', category: 'isolation', equipment: ['bodyweight'],             alternatives: ['lib-cable-crunch'] },
  { id: 'lib-cable-crunch',  name: 'Cable Crunch',              muscleGroup: 'Core',      type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-crunch'] },
  { id: 'lib-hanging-leg',   name: 'Hanging Leg Raise',         muscleGroup: 'Core',      type: 'Strength', category: 'isolation', equipment: ['bodyweight'],             alternatives: ['lib-lying-leg-raise'] },
  { id: 'lib-lying-leg-raise', name: 'Lying Leg Raise',         muscleGroup: 'Core',      type: 'Strength', category: 'isolation', equipment: ['bodyweight'],             alternatives: ['lib-hanging-leg'] },
  { id: 'lib-ab-wheel',      name: 'Ab Wheel Rollout',          muscleGroup: 'Core',      type: 'Strength', category: 'isolation', equipment: ['other'],                  alternatives: ['lib-plank'] },
  { id: 'lib-russian-twist', name: 'Russian Twist',             muscleGroup: 'Core',      type: 'Strength', category: 'isolation', equipment: ['bodyweight'],             alternatives: ['lib-woodchop'] },
  { id: 'lib-woodchop',      name: 'Cable Woodchop',            muscleGroup: 'Core',      type: 'Strength', category: 'isolation', equipment: ['cable'],                  alternatives: ['lib-russian-twist'] },
  { id: 'lib-pallof-press',  name: 'Pallof Press',              muscleGroup: 'Core',      type: 'Strength', category: 'isolation', equipment: ['cable', 'band'],          alternatives: ['lib-plank'] },

  // ── TRAPS ─────────────────────────────────────────────────────────────
  { id: 'lib-bb-shrug',       name: 'Barbell Shrug',             muscleGroup: 'Traps',     type: 'Strength', category: 'isolation', equipment: ['barbell'],                alternatives: ['lib-db-shrug', 'lib-trap-bar-shrug'] },
  { id: 'lib-db-shrug',       name: 'Dumbbell Shrug',            muscleGroup: 'Traps',     type: 'Strength', category: 'isolation', equipment: ['dumbbell'],               alternatives: ['lib-bb-shrug'] },
  { id: 'lib-trap-bar-shrug', name: 'Trap Bar Shrug',            muscleGroup: 'Traps',     type: 'Strength', category: 'isolation', equipment: ['barbell'],                alternatives: ['lib-bb-shrug', 'lib-db-shrug'] },
  { id: 'lib-upright-row',    name: 'Upright Row',               muscleGroup: 'Traps',     type: 'Strength', category: 'compound',  equipment: ['barbell'],                alternatives: ['lib-db-shrug', 'lib-cable-upright-row'] },
  { id: 'lib-cable-upright-row', name: 'Cable Upright Row',      muscleGroup: 'Traps',     type: 'Strength', category: 'compound',  equipment: ['cable'],                  alternatives: ['lib-upright-row'] },
  { id: 'lib-smith-shrug',    name: 'Smith Machine Shrug',       muscleGroup: 'Traps',     type: 'Strength', category: 'isolation', equipment: ['smith'],                  alternatives: ['lib-bb-shrug'] },

  // ── FOREARMS ──────────────────────────────────────────────────────────
  { id: 'lib-wrist-curl',     name: 'Wrist Curl',                muscleGroup: 'Forearms',  type: 'Strength', category: 'isolation', equipment: ['barbell'],                alternatives: ['lib-db-wrist-curl'] },
  { id: 'lib-db-wrist-curl',  name: 'Dumbbell Wrist Curl',       muscleGroup: 'Forearms',  type: 'Strength', category: 'isolation', equipment: ['dumbbell'],               alternatives: ['lib-wrist-curl'] },
  { id: 'lib-reverse-curl',   name: 'Reverse Curl',              muscleGroup: 'Forearms',  type: 'Strength', category: 'isolation', equipment: ['barbell'],                alternatives: ['lib-hammer-curl'] },
  { id: 'lib-farmer-walk',    name: 'Farmer\'s Walk',            muscleGroup: 'Forearms',  type: 'Strength', category: 'compound',  equipment: ['dumbbell'],               alternatives: ['lib-bb-shrug'] },
  { id: 'lib-plate-pinch',    name: 'Plate Pinch Hold',          muscleGroup: 'Forearms',  type: 'Strength', category: 'isolation', equipment: ['other'],                  alternatives: ['lib-wrist-curl'] },
];

// ── Lookup helpers ──────────────────────────────────────────────────────
export function getExerciseById(id) {
  return exerciseLibrary.find(e => e.id === id) || null;
}

export function getExercisesByMuscle(muscleGroup) {
  return exerciseLibrary.filter(e => e.muscleGroup === muscleGroup);
}

export function getExercisesByEquipment(equipmentTag) {
  return exerciseLibrary.filter(e => e.equipment.includes(equipmentTag));
}

export function getAlternatives(id) {
  const ex = getExerciseById(id);
  if (!ex) return [];
  return ex.alternatives.map(getExerciseById).filter(Boolean);
}

export function getCompoundExercises(muscleGroup) {
  return exerciseLibrary.filter(e => e.muscleGroup === muscleGroup && e.category === 'compound');
}

export function getIsolationExercises(muscleGroup) {
  return exerciseLibrary.filter(e => e.muscleGroup === muscleGroup && e.category === 'isolation');
}

// Filter for equipment availability (full gym, home, bodyweight)
export function filterByEquipmentProfile(profile) {
  const allowed = {
    'full-gym': ['barbell', 'dumbbell', 'cable', 'machine', 'smith', 'bench', 'bodyweight', 'band', 'other'],
    'home':     ['dumbbell', 'bench', 'bodyweight', 'band', 'other'],
    'bodyweight': ['bodyweight'],
  };
  const tags = allowed[profile] || allowed['full-gym'];
  return exerciseLibrary.filter(e => e.equipment.every(eq => tags.includes(eq)));
}

export default exerciseLibrary;
