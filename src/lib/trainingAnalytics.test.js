import {
  buildTrainingAnalytics,
  calculateEpleyE1RM,
  detectSessionPrEvents,
} from './trainingAnalytics';

const exercises = [
  { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest', type: 'Strength' },
  { id: 'row', name: 'Row', muscleGroup: 'Back', type: 'Strength' },
  { id: 'run', name: 'Run', muscleGroup: 'Cardio', type: 'Cardio' },
];

describe('training analytics', () => {
  test('calculates Epley e1RM while excluding warmups', () => {
    expect(calculateEpleyE1RM({ weight: 100, reps: 6 })).toBe(120);
    const model = buildTrainingAnalytics({
      exercises,
      logs: {
        bench: [{ date: '2026-07-16T08:00:00.000Z', sets: [
          { weight: 140, reps: 2, setType: 'warmup' },
          { weight: 100, reps: 6 },
        ] }],
      },
      now: new Date('2026-07-18T12:00:00.000Z'),
    });

    expect(model.e1rmRecords).toEqual([
      expect.objectContaining({ exerciseId: 'bench', e1rm: 120, weight: 100, reps: 6 }),
    ]);
  });

  test('builds truthful weekly, streak, cardio, latest PR and muscle-group analytics from logs', () => {
    const model = buildTrainingAnalytics({
      exercises,
      activeSession: { planId: 'upper', planName: 'Upper', startedAt: '2026-07-18T07:00:00.000Z' },
      logs: {
        bench: [
          { date: '2026-07-10T08:00:00.000Z', sets: [{ weight: 80, reps: 5 }], totalVolume: 400 },
          { date: '2026-07-15T08:00:00.000Z', workoutSessionStartedAt: 'lift-a', sets: [{ weight: 100, reps: 6 }], totalVolume: 600 },
          { date: '2026-07-17T08:00:00.000Z', sets: [{ weight: 102.5, reps: 5 }], totalVolume: 512.5 },
        ],
        row: [
          { date: '2026-07-15T08:20:00.000Z', workoutSessionStartedAt: 'lift-a', sets: [{ weight: 80, reps: 10 }], totalVolume: 800 },
        ],
        run: [
          { date: '2026-07-18T08:00:00.000Z', durationMinutes: 30, distanceKm: 5, sets: [{ reps: 1, weight: 0 }] },
        ],
      },
      now: new Date('2026-07-18T12:00:00.000Z'),
    });

    expect(model.weekly.sessionCount).toBe(3);
    expect(model.weekly.trainingDays).toBe(3);
    expect(model.sevenDayVolume).toBe(1912.5);
    expect(model.streak.trainingDays).toBe(3);
    expect(model.lastWorkout.exerciseName).toBe('Run');
    expect(model.activeResume.planName).toBe('Upper');
    expect(model.cardio.sessions[0]).toEqual(expect.objectContaining({ exerciseName: 'Run', durationMinutes: 30 }));
    expect(model.latestPrs.map((record) => record.exerciseName)).toEqual(['Bench Press', 'Row']);
    expect(model.muscleGroupWeeklyVolume).toEqual([
      { muscleGroup: 'Back', volume: 800 },
      { muscleGroup: 'Chest', volume: 1112.5 },
    ]);
  });

  test('uses deterministic ties for equal e1RM values', () => {
    const model = buildTrainingAnalytics({
      exercises,
      logs: {
        bench: [
          { date: '2026-07-17T08:00:00.000Z', sets: [{ weight: 90, reps: 10 }] },
          { date: '2026-07-16T08:00:00.000Z', sets: [{ weight: 100, reps: 6 }] },
        ],
      },
      now: new Date('2026-07-18T12:00:00.000Z'),
    });

    expect(model.e1rmRecords[0]).toEqual(expect.objectContaining({
      e1rm: 120,
      weight: 100,
      reps: 6,
      achievedAt: '2026-07-16T08:00:00.000Z',
    }));
  });

  test('detects only new all-time PR metadata for a saved session', () => {
    expect(detectSessionPrEvents({
      exercise: exercises[0],
      existingSessions: [{ date: '2026-07-10T08:00:00.000Z', sets: [{ weight: 100, reps: 5 }] }],
      candidateSession: { date: '2026-07-18T08:00:00.000Z', sets: [{ weight: 100, reps: 6 }] },
    })).toEqual([
      expect.objectContaining({ type: 'e1rm', exerciseId: 'bench', e1rm: 120, previousE1rm: 116.66666666666667 }),
    ]);
  });

  test('one-year fixture computes under 100 ms', () => {
    const logs = { bench: Array.from({ length: 365 }, (_, index) => ({
      date: new Date(Date.UTC(2025, 6, 18 + index, 8)).toISOString(),
      sets: [{ weight: 80 + (index % 40), reps: 5 + (index % 8) }],
    })) };
    const started = performance.now();
    const model = buildTrainingAnalytics({ exercises, logs, now: new Date('2026-07-18T12:00:00.000Z') });
    const elapsed = performance.now() - started;

    expect(model.e1rmRecords).toHaveLength(1);
    expect(elapsed).toBeLessThan(100);
  });
});
