function safeDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayKey(value) {
  const date = safeDate(value);
  if (!date) return 'unknown';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function numeric(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function sessionSets(session = {}) {
  return Array.isArray(session.sets) ? session.sets : [];
}

export function flattenLoggedSessions(logs = {}, exercises = []) {
  const exerciseMap = new Map(exercises.map((exercise) => [String(exercise.id), exercise]));
  const sessions = [];

  Object.entries(logs || {}).forEach(([exerciseId, exerciseSessions]) => {
    if (!Array.isArray(exerciseSessions)) return;
    const exercise = exerciseMap.get(String(exerciseId)) || { id: exerciseId, name: 'Unknown exercise' };
    exerciseSessions.forEach((session, index) => {
      const date = safeDate(session?.date);
      if (!session || !date) return;
      const sets = sessionSets(session);
      sessions.push({
        ...session,
        exerciseId: exercise.id,
        exerciseName: exercise.name || 'Unknown exercise',
        muscleGroup: exercise.muscleGroup || '',
        exerciseType: exercise.type || '',
        date: date.toISOString(),
        dayKey: dayKey(date),
        setCount: sets.filter((set) => numeric(set.reps) > 0).length,
        totalReps: numeric(session.totalReps) || sets.reduce((sum, set) => sum + numeric(set.reps), 0),
        totalVolume: numeric(session.totalVolume) || sets.reduce(
          (sum, set) => sum + (numeric(set.reps) * numeric(set.weight)),
          0
        ),
        sessionKey: `${exercise.id}:${session.date || index}`,
      });
    });
  });

  return sessions.sort((left, right) => new Date(right.date) - new Date(left.date));
}

export function formatVolume(value) {
  const amount = numeric(value);
  if (amount >= 1000) {
    const tonnes = (amount / 1000).toFixed(1).replace(/\.0$/, '');
    return `${tonnes}t`;
  }
  return `${Math.round(amount)} kg`;
}

export function buildTodayModel({ logs = {}, exercises = [], activeSession = null, now = new Date() } = {}) {
  const sessions = flattenLoggedSessions(logs, exercises);
  const current = safeDate(now) || new Date();
  const weekStart = new Date(current);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekSessions = sessions.filter((session) => new Date(session.date) >= weekStart && new Date(session.date) <= current);
  const trainingDays = new Set(weekSessions.map((session) => session.dayKey)).size;

  const strengthPrs = exercises
    .filter((exercise) => String(exercise.type || '').toLowerCase() !== 'cardio' && String(exercise.muscleGroup || '').toLowerCase() !== 'cardio')
    .map((exercise) => {
      const exerciseSessions = sessions.filter((session) => String(session.exerciseId) === String(exercise.id));
      const best = exerciseSessions.flatMap((session) => sessionSets(session)).reduce((winner, set) => {
        const candidate = { weight: numeric(set.weight), reps: numeric(set.reps) };
        if (!candidate.weight || !candidate.reps) return winner;
        if (!winner || candidate.weight > winner.weight || (candidate.weight === winner.weight && candidate.reps > winner.reps)) return candidate;
        return winner;
      }, null);
      return best ? {
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        label: 'Heaviest set',
        value: `${best.weight} kg × ${best.reps}`,
      } : null;
    })
    .filter(Boolean);

  const cardioSessions = sessions
    .filter((session) => String(session.exerciseType).toLowerCase() === 'cardio' || String(session.muscleGroup).toLowerCase() === 'cardio')
    .slice(0, 3)
    .map((session) => ({
      exerciseId: session.exerciseId,
      exerciseName: session.exerciseName,
      date: session.date,
      value: [
        session.distanceKm ? `${numeric(session.distanceKm)} km` : null,
        session.durationMinutes ? `${numeric(session.durationMinutes)} min` : null,
      ].filter(Boolean).join(' · ') || `${session.totalReps} logged`,
    }));

  return {
    activeSession,
    week: {
      sessionCount: weekSessions.length,
      trainingDays,
      volume: weekSessions.reduce((sum, session) => sum + session.totalVolume, 0),
      setCount: weekSessions.reduce((sum, session) => sum + session.setCount, 0),
    },
    lastWorkout: sessions[0] || null,
    strengthPrs,
    cardioSessions,
    streak: null,
    goal: null,
    isEmpty: sessions.length === 0 && !activeSession,
  };
}

export function buildHistoryModel({ logs = {}, exercises = [], limit = 50 } = {}) {
  const allSessions = flattenLoggedSessions(logs, exercises);
  const visibleSessions = allSessions.slice(0, Math.max(1, limit));
  const dayMap = new Map();
  visibleSessions.forEach((session) => {
    if (!dayMap.has(session.dayKey)) {
      dayMap.set(session.dayKey, { key: session.dayKey, date: session.date, sessions: [] });
    }
    dayMap.get(session.dayKey).sessions.push(session);
  });

  return {
    days: Array.from(dayMap.values()).map((day) => ({
      ...day,
      setCount: day.sessions.reduce((sum, session) => sum + session.setCount, 0),
      volume: day.sessions.reduce((sum, session) => sum + session.totalVolume, 0),
    })),
    totalSessions: allSessions.length,
    renderedSessions: visibleSessions.length,
    hasMore: visibleSessions.length < allSessions.length,
    isEmpty: allSessions.length === 0,
  };
}
