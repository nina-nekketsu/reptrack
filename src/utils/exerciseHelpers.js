// ── LocalStorage helpers ──

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

export { defaultExercises };

export function loadExercises() {
  try {
    const saved = localStorage.getItem('exercises');
    return saved ? JSON.parse(saved) : defaultExercises;
  } catch {
    return defaultExercises;
  }
}

export function loadLogs() {
  try {
    const saved = localStorage.getItem('exerciseLogs');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

export function saveLogs(logs) {
  localStorage.setItem('exerciseLogs', JSON.stringify(logs));
}

export function saveExercises(exercises) {
  localStorage.setItem('exercises', JSON.stringify(exercises));
}

// ── Calculations ──

export function calcTotals(sets) {
  const totalReps = sets.reduce((sum, s) => sum + (Number(s.reps) || 0), 0);
  const totalVolume = sets.reduce(
    (sum, s) => sum + (Number(s.reps) || 0) * (Number(s.weight) || 0),
    0
  );
  return { totalReps, totalVolume };
}

export function bestSet(sets) {
  if (!sets || sets.length === 0) return null;
  return sets.reduce((best, s) => {
    const score = (Number(s.weight) || 0) * (1 + (Number(s.reps) || 0) / 30);
    const bestScore = (Number(best.weight) || 0) * (1 + (Number(best.reps) || 0) / 30);
    return score > bestScore ? s : best;
  }, sets[0]);
}

export function getRecords(sessions) {
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

export function getSessionsAsc(logs, exerciseId) {
  const entry = logs[exerciseId];
  if (!entry) return [];
  return [...entry].sort((a, b) => new Date(a.date) - new Date(b.date));
}

export function getSessionsDesc(logs, exerciseId) {
  const entry = logs[exerciseId];
  if (!entry) return [];
  return [...entry].sort((a, b) => new Date(b.date) - new Date(a.date));
}
