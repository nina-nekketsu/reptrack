import {
  buildTodayModel,
  buildHistoryModel,
  formatVolume,
  flattenLoggedSessions,
} from './productSurfaceData';

const exercises = [
  { id: 1, name: 'Bench Press', muscleGroup: 'Chest', type: 'Strength' },
  { id: 2, name: 'Run', muscleGroup: 'Cardio', type: 'Cardio' },
  { id: 3, name: 'Squat', muscleGroup: 'Legs', type: 'Strength' },
];

const logs = {
  1: [
    { date: '2026-07-13T09:00:00.000Z', sets: [{ reps: 5, weight: 100 }], totalReps: 5, totalVolume: 500 },
    { date: '2026-07-15T10:00:00.000Z', sets: [{ reps: 6, weight: 105 }], totalReps: 6, totalVolume: 630 },
  ],
  2: [
    { date: '2026-07-15T08:00:00.000Z', sets: [{ reps: 1, weight: 0 }], totalReps: 1, totalVolume: 0, durationMinutes: 32, distanceKm: 5 },
  ],
  3: [
    { date: '2026-07-05T09:00:00.000Z', sets: [{ reps: 5, weight: 120 }], totalReps: 5, totalVolume: 600 },
  ],
};

describe('product surface data', () => {
  test('flattens only real logged sessions and attaches exercise metadata', () => {
    expect(flattenLoggedSessions(logs, exercises).map((session) => session.exerciseName)).toEqual([
      'Bench Press',
      'Run',
      'Bench Press',
      'Squat',
    ]);
  });

  test('builds Today from real logs and active session without fabricated streaks', () => {
    const model = buildTodayModel({
      logs,
      exercises,
      activeSession: { planId: 'push', planName: 'Push Day', startedAt: '2026-07-16T07:00:00.000Z', status: 'active' },
      now: new Date('2026-07-16T12:00:00.000Z'),
    });

    expect(model.activeSession.planName).toBe('Push Day');
    expect(model.week.sessionCount).toBe(3);
    expect(model.week.trainingDays).toBe(2);
    expect(model.week.volume).toBe(1130);
    expect(model.lastWorkout.exerciseName).toBe('Bench Press');
    expect(model.strengthPrs).toEqual([
      expect.objectContaining({ exerciseName: 'Bench Press', label: 'Heaviest set', value: '105 kg × 6' }),
      expect.objectContaining({ exerciseName: 'Squat', label: 'Heaviest set', value: '120 kg × 5' }),
    ]);
    expect(model.cardioSessions).toEqual([
      expect.objectContaining({ exerciseName: 'Run', value: '5 km · 32 min' }),
    ]);
    expect(model.streak).toBeNull();
    expect(model.goal).toBeNull();
  });

  test('returns honest empty Today model when there are no logs or active session', () => {
    const model = buildTodayModel({ logs: {}, exercises, activeSession: null, now: new Date('2026-07-16T12:00:00.000Z') });
    expect(model.isEmpty).toBe(true);
    expect(model.week).toEqual({ sessionCount: 0, trainingDays: 0, volume: 0, setCount: 0 });
    expect(model.lastWorkout).toBeNull();
    expect(model.strengthPrs).toEqual([]);
    expect(model.cardioSessions).toEqual([]);
  });

  test('groups History sessions by real calendar day and bounds large histories', () => {
    const manyLogs = { 1: Array.from({ length: 65 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 6, 16 - index, 9)).toISOString(),
      sets: [{ reps: 5, weight: 100 + index }],
      totalReps: 5,
      totalVolume: 500 + index,
    })) };

    const model = buildHistoryModel({ logs: manyLogs, exercises, limit: 50 });
    expect(model.totalSessions).toBe(65);
    expect(model.renderedSessions).toBe(50);
    expect(model.hasMore).toBe(true);
    expect(model.days[0].key).toBe('2026-07-16');
    expect(model.days[0].sessions[0]).toEqual(expect.objectContaining({ exerciseName: 'Bench Press', exerciseId: 1 }));
  });

  test('formats volume honestly without pretending zero is a workout', () => {
    expect(formatVolume(0)).toBe('0 kg');
    expect(formatVolume(1130)).toBe('1.1t');
  });
});
