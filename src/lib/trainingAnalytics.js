function safeDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
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

function isWarmupSet(set = {}) {
  const type = String(set.setType || set.type || '').toLowerCase();
  return type === 'warmup' || type === 'warm-up';
}

function isCardioExercise(exercise = {}) {
  return String(exercise.type || '').toLowerCase() === 'cardio'
    || String(exercise.muscleGroup || '').toLowerCase() === 'cardio';
}

function epleyRaw(weight, reps) {
  const cleanWeight = numeric(weight);
  const cleanReps = numeric(reps);
  if (cleanWeight <= 0 || cleanReps <= 0) return 0;
  return cleanWeight * (1 + (cleanReps / 30));
}

function workSets(session = {}) {
  return sessionSets(session).filter((set) => !isWarmupSet(set) && numeric(set.reps) > 0);
}

function setVolume(set = {}) {
  return numeric(set.weight) * numeric(set.reps);
}

function sessionVolume(session = {}) {
  const sets = workSets(session);
  if (sets.length > 0) return sets.reduce((sum, set) => sum + setVolume(set), 0);
  return numeric(session.totalVolume);
}

function sessionIdentity(session, fallback) {
  return session.workoutSessionStartedAt
    || session.workoutStartedAt
    || session.sessionId
    || session.clientSessionId
    || fallback;
}

function hasExplicitSessionIdentity(session = {}) {
  return Boolean(session.workoutSessionStartedAt
    || session.workoutStartedAt
    || session.sessionId
    || session.clientSessionId);
}

function sortRecords(left, right) {
  if (right.e1rm !== left.e1rm) return right.e1rm - left.e1rm;
  if (right.weight !== left.weight) return right.weight - left.weight;
  if (right.reps !== left.reps) return right.reps - left.reps;
  return String(left.achievedAt).localeCompare(String(right.achievedAt));
}

export function calculateEpleyE1RM(set = {}) {
  const value = epleyRaw(set.weight, set.reps);
  return Number.isInteger(value) ? value : Number(value.toFixed(1));
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
      const cleanWorkSets = workSets(session);
      sessions.push({
        ...session,
        exerciseId: exercise.id,
        exerciseName: exercise.name || 'Unknown exercise',
        muscleGroup: exercise.muscleGroup || '',
        exerciseType: exercise.type || '',
        date: date.toISOString(),
        dayKey: dayKey(date),
        setCount: cleanWorkSets.length || sets.filter((set) => numeric(set.reps) > 0).length,
        totalReps: numeric(session.totalReps) || cleanWorkSets.reduce((sum, set) => sum + numeric(set.reps), 0),
        totalVolume: sessionVolume(session),
        sessionKey: hasExplicitSessionIdentity(session)
          ? String(sessionIdentity(session, session.date || index))
          : `${exercise.id}:${sessionIdentity(session, session.date || index)}`,
      });
    });
  });

  return sessions.sort((left, right) => new Date(right.date) - new Date(left.date));
}

function buildE1RMRecords(logs, exercises) {
  return exercises
    .filter((exercise) => !isCardioExercise(exercise))
    .map((exercise) => {
      const sessions = Array.isArray(logs?.[exercise.id]) ? logs[exercise.id] : logs?.[String(exercise.id)] || [];
      const records = [];
      sessions.forEach((session) => {
        const achievedAt = safeDate(session?.date)?.toISOString();
        if (!achievedAt) return;
        workSets(session).forEach((set) => {
          const raw = epleyRaw(set.weight, set.reps);
          if (!raw) return;
          records.push({
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            muscleGroup: exercise.muscleGroup || '',
            e1rm: Number.isInteger(raw) ? raw : Number(raw.toFixed(1)),
            rawE1rm: raw,
            weight: numeric(set.weight),
            reps: numeric(set.reps),
            achievedAt,
          });
        });
      });
      return records.sort(sortRecords)[0] || null;
    })
    .filter(Boolean);
}

function startOfWeek(now) {
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return date;
}

function buildRestDayTolerantStreak(sessions, now) {
  const trainingDays = new Set(sessions.map((session) => session.dayKey));
  const cursor = safeDate(now) || new Date();
  cursor.setHours(0, 0, 0, 0);
  let countedTrainingDays = 0;
  let consecutiveRestDays = 0;

  for (let offset = 0; offset < 366; offset += 1) {
    const key = dayKey(cursor);
    if (trainingDays.has(key)) {
      countedTrainingDays += 1;
      consecutiveRestDays = 0;
    } else {
      consecutiveRestDays += 1;
      if (consecutiveRestDays > 1) break;
    }
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    trainingDays: countedTrainingDays,
    tolerant: true,
  };
}

function buildCardioSessions(sessions) {
  return sessions
    .filter((session) => String(session.exerciseType).toLowerCase() === 'cardio' || String(session.muscleGroup).toLowerCase() === 'cardio')
    .slice(0, 3)
    .map((session) => ({
      exerciseId: session.exerciseId,
      exerciseName: session.exerciseName,
      date: session.date,
      durationMinutes: numeric(session.durationMinutes),
      distanceKm: numeric(session.distanceKm),
      value: [
        session.distanceKm ? `${numeric(session.distanceKm)} km` : null,
        session.durationMinutes ? `${numeric(session.durationMinutes)} min` : null,
      ].filter(Boolean).join(' · ') || `${session.totalReps} logged`,
    }));
}

export function buildTrainingAnalytics({ logs = {}, exercises = [], activeSession = null, now = new Date() } = {}) {
  const sessions = flattenLoggedSessions(logs, exercises);
  const current = safeDate(now) || new Date();
  const weekStart = startOfWeek(current);
  const sevenDayStart = new Date(current);
  sevenDayStart.setDate(sevenDayStart.getDate() - 7);
  sevenDayStart.setHours(0, 0, 0, 0);

  const weekSessions = sessions.filter((session) => {
    const date = safeDate(session.date);
    return date && date >= weekStart && date <= current;
  });
  const sevenDaySessions = sessions.filter((session) => {
    const date = safeDate(session.date);
    return date && date >= sevenDayStart && date <= current;
  });

  const sessionKeys = new Set(weekSessions.map((session) => session.sessionKey));
  const trainingDays = new Set(weekSessions.map((session) => session.dayKey));
  const e1rmRecords = buildE1RMRecords(logs, exercises);
  const muscleVolumes = new Map();
  weekSessions.forEach((session) => {
    if (String(session.exerciseType).toLowerCase() === 'cardio' || String(session.muscleGroup).toLowerCase() === 'cardio') return;
    if (!session.muscleGroup) return;
    muscleVolumes.set(session.muscleGroup, (muscleVolumes.get(session.muscleGroup) || 0) + session.totalVolume);
  });

  return {
    activeResume: activeSession,
    e1rmRecords,
    latestPrs: e1rmRecords,
    weekly: {
      sessionCount: sessionKeys.size,
      trainingDays: trainingDays.size,
      volume: weekSessions.reduce((sum, session) => sum + session.totalVolume, 0),
      setCount: weekSessions.reduce((sum, session) => sum + session.setCount, 0),
    },
    sevenDayVolume: sevenDaySessions.reduce((sum, session) => sum + session.totalVolume, 0),
    weeklySessions: trainingDays.size,
    streak: buildRestDayTolerantStreak(sessions, current),
    lastWorkout: sessions[0] || null,
    cardio: {
      sessions: buildCardioSessions(sessions),
    },
    muscleGroupWeeklyVolume: Array.from(muscleVolumes.entries())
      .map(([muscleGroup, volume]) => ({ muscleGroup, volume }))
      .sort((left, right) => left.muscleGroup.localeCompare(right.muscleGroup)),
    isEmpty: sessions.length === 0 && !activeSession,
  };
}

export function detectSessionPrEvents({ exercise, existingSessions = [], candidateSession } = {}) {
  if (!exercise || !candidateSession || isCardioExercise(exercise)) return [];
  const existingRecords = buildE1RMRecords({ [exercise.id]: existingSessions }, [exercise]);
  const candidateRecords = buildE1RMRecords({ [exercise.id]: [candidateSession] }, [exercise]);
  const previous = existingRecords[0];
  const candidate = candidateRecords[0];
  if (!candidate || (previous && candidate.rawE1rm <= previous.rawE1rm)) return [];

  return [{
    type: 'e1rm',
    exerciseId: exercise.id,
    exerciseName: exercise.name,
    e1rm: candidate.e1rm,
    previousE1rm: previous?.rawE1rm || null,
    weight: candidate.weight,
    reps: candidate.reps,
    achievedAt: candidate.achievedAt,
  }];
}
