import {
  buildTrainingAnalytics,
  flattenLoggedSessions as flattenAnalyticsSessions,
} from '../lib/trainingAnalytics';

function safeDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
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

export function flattenLoggedSessions(logs = {}, exercises = []) {
  return flattenAnalyticsSessions(logs, exercises);
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
  const analytics = buildTrainingAnalytics({ logs, exercises, activeSession, now });
  const sessions = flattenLoggedSessions(logs, exercises);
  const current = safeDate(now) || new Date();
  const weekStart = new Date(current);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
  const weekSessions = sessions.filter((session) => new Date(session.date) >= weekStart && new Date(session.date) <= current);

  return {
    ...analytics,
    activeSession,
    week: {
      ...analytics.weekly,
      sessionCount: weekSessions.length,
    },
    lastWorkout: sessions[0] || null,
    strengthPrs: exercises
      .filter((exercise) => String(exercise.type || '').toLowerCase() !== 'cardio' && String(exercise.muscleGroup || '').toLowerCase() !== 'cardio')
      .map((exercise) => {
        const exerciseSessions = sessions.filter((session) => String(session.exerciseId) === String(exercise.id));
        const best = exerciseSessions.flatMap((session) => sessionSets(session)).reduce((winner, set) => {
          if (isWarmupSet(set)) return winner;
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
      .filter(Boolean),
    cardioSessions: analytics.cardio.sessions,
    goal: null,
    isEmpty: analytics.isEmpty,
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
