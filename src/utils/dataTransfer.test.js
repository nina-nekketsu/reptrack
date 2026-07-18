import {
  DATA_EXPORT_SCHEMA_VERSION,
  applyDataImport,
  createDataExport,
  previewDataImport,
} from './dataTransfer';

describe('RepTrack data export and additive import', () => {
  beforeEach(() => localStorage.clear());

  test('creates a versioned snapshot of exercises, plans, logs, settings, and coach state', () => {
    localStorage.setItem('exercises', JSON.stringify([{ id: 'squat', name: 'Squat' }]));
    localStorage.setItem('workoutPlans', JSON.stringify([{ id: 'legs', name: 'Leg day' }]));
    localStorage.setItem('exerciseLogs', JSON.stringify({ squat: [{ date: '2026-07-16T08:00:00.000Z', sets: [] }] }));
    localStorage.setItem('timerAutoStart', 'true');
    localStorage.setItem('timerGlobalRestDefault', '90');
    localStorage.setItem('coach_profile', JSON.stringify({ goal: 'strength' }));

    const snapshot = createDataExport(localStorage, '2026-07-16T12:00:00.000Z');

    expect(snapshot).toEqual(expect.objectContaining({
      app: 'RepTrack',
      schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
      exportedAt: '2026-07-16T12:00:00.000Z',
    }));
    expect(snapshot.data.exercises).toEqual([{ id: 'squat', name: 'Squat' }]);
    expect(snapshot.data.workoutPlans).toEqual([{ id: 'legs', name: 'Leg day' }]);
    expect(snapshot.data.exerciseLogs.squat).toHaveLength(1);
    expect(snapshot.data.settings).toEqual(expect.objectContaining({
      timerAutoStart: true,
      timerGlobalRestDefault: 90,
    }));
    expect(snapshot.data.coach.profile.goal).toBe('strength');
  });

  test('previews an additive import without mutating current data', () => {
    localStorage.setItem('exercises', JSON.stringify([{ id: 'squat', name: 'Current Squat' }]));
    const snapshot = {
      app: 'RepTrack',
      schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
      data: {
        exercises: [{ id: 'squat', name: 'Imported Squat' }, { id: 'bench', name: 'Bench Press' }],
        workoutPlans: [],
        exerciseLogs: {},
        settings: {},
        coach: {},
      },
    };

    const preview = previewDataImport(snapshot, localStorage);

    expect(preview.valid).toBe(true);
    expect(preview.summary.exercises).toEqual({ add: 1, keep: 1 });
    expect(JSON.parse(localStorage.getItem('exercises'))).toEqual([{ id: 'squat', name: 'Current Squat' }]);
  });

  test('applies imports additively without overwriting existing records or duplicate sessions', () => {
    const existingSession = { date: '2026-07-16T08:00:00.000Z', remoteId: 'remote-1', sets: [{ reps: 5 }] };
    localStorage.setItem('exercises', JSON.stringify([{ id: 'squat', name: 'Current Squat' }]));
    localStorage.setItem('exerciseLogs', JSON.stringify({ squat: [existingSession] }));
    localStorage.setItem('timerAutoStart', 'false');

    const snapshot = {
      app: 'RepTrack',
      schemaVersion: DATA_EXPORT_SCHEMA_VERSION,
      data: {
        exercises: [{ id: 'squat', name: 'Imported Squat' }, { id: 'bench', name: 'Bench Press' }],
        workoutPlans: [{ id: 'upper', name: 'Upper' }],
        exerciseLogs: {
          squat: [
            { ...existingSession, sets: [{ reps: 99 }] },
            { date: '2026-07-15T08:00:00.000Z', sets: [{ reps: 8 }] },
          ],
        },
        settings: { timerAutoStart: true, timerGlobalRestDefault: 120 },
        coach: { profile: { goal: 'strength', progression: 'moderate' } },
      },
    };

    const result = applyDataImport(snapshot, localStorage);

    expect(result.valid).toBe(true);
    expect(JSON.parse(localStorage.getItem('exercises'))).toEqual([
      { id: 'squat', name: 'Current Squat' },
      { id: 'bench', name: 'Bench Press' },
    ]);
    expect(JSON.parse(localStorage.getItem('exerciseLogs')).squat).toEqual([
      existingSession,
      { date: '2026-07-15T08:00:00.000Z', sets: [{ reps: 8 }] },
    ]);
    expect(localStorage.getItem('timerAutoStart')).toBe('false');
    expect(localStorage.getItem('timerGlobalRestDefault')).toBe('120');
    expect(JSON.parse(localStorage.getItem('coach_profile'))).toEqual({ goal: 'strength', progression: 'moderate' });
  });

  test('rejects unsupported or malformed snapshots without writing data', () => {
    localStorage.setItem('exercises', JSON.stringify([{ id: 'safe' }]));

    expect(previewDataImport({ schemaVersion: 999, data: {} }, localStorage)).toEqual(expect.objectContaining({ valid: false }));
    expect(() => applyDataImport({ schemaVersion: 999, data: {} }, localStorage)).toThrow(/Unsupported RepTrack export/);
    expect(JSON.parse(localStorage.getItem('exercises'))).toEqual([{ id: 'safe' }]);
  });
});
