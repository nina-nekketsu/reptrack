const mockFrom = jest.fn();
const mockPullActiveWorkoutSession = jest.fn();

jest.mock('./clientDiagnosticsRuntime', () => ({
  clientDiagnostics: {
    incrementSyncFailure: jest.fn(),
    recordError: jest.fn(),
  },
}));

jest.mock('./supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

jest.mock('./activeWorkoutSessionSync', () => ({
  pullActiveWorkoutSession: (...args) => mockPullActiveWorkoutSession(...args),
  pushActiveWorkoutSession: jest.fn().mockResolvedValue(null),
}));

const storedOperation = (overrides) => ({
  id: `mutation-${overrides.idempotencyKey}`,
  kind: overrides.kind,
  entityId: overrides.entityId,
  idempotencyKey: overrides.idempotencyKey,
  payload: overrides.payload,
  status: overrides.status || 'failed',
  attempts: 1,
  lastError: { message: 'offline' },
  createdAt: 1,
  updatedAt: 2,
});

function queryResult(result) {
  const api = {};
  api.select = jest.fn(() => api);
  api.eq = jest.fn(() => api);
  api.maybeSingle = jest.fn(async () => result);
  api.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return api;
}

function loadSyncModule() {
  jest.resetModules();
  return require('./sync');
}

describe('pull recovery with durable local mutations', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFrom.mockReset();
    mockPullActiveWorkoutSession.mockReset();
    mockPullActiveWorkoutSession.mockResolvedValue(null);
  });

  test('preserves pending edits and deletion tombstones instead of resurrecting remote snapshots', async () => {
    localStorage.setItem('exercises', JSON.stringify([
      { id: 'edited-exercise', name: 'LOCAL NAME', muscleGroup: 'Chest', type: 'Strength' },
    ]));
    localStorage.setItem('workoutPlans', JSON.stringify([
      { id: 'edited-plan', name: 'LOCAL PLAN', exercises: ['edited-exercise'] },
    ]));
    localStorage.setItem('exerciseLogs', JSON.stringify({
      'edited-exercise': [{
        date: '2026-10-12T08:00:00.000Z',
        clientSessionId: 'pending-session',
        sets: [{ reps: 8, weight: 100 }],
        totalReps: 8,
        totalVolume: 800,
      }],
    }));
    localStorage.setItem('currentPlanId', 'edited-plan');
    localStorage.setItem('timerAutoStart', 'true');
    localStorage.setItem('coach_profile', JSON.stringify({ goal: 'LOCAL GOAL' }));

    const operations = [
      storedOperation({
        kind: 'exercise/update', entityId: 'edited-exercise', idempotencyKey: 'user-1:exercise:edited-exercise',
        payload: { id: 'edited-exercise', user_id: 'user-1', name: 'LOCAL NAME', muscle_group: 'Chest', type: 'Strength' },
      }),
      storedOperation({
        kind: 'exercise/delete', entityId: 'deleted-exercise', idempotencyKey: 'user-1:exercise-delete:deleted-exercise',
        payload: { exercise_id: 'deleted-exercise', user_id: 'user-1' },
      }),
      storedOperation({
        kind: 'plan/update', entityId: 'edited-plan', idempotencyKey: 'user-1:plan:edited-plan',
        payload: { id: 'edited-plan', user_id: 'user-1', name: 'LOCAL PLAN', exercises: ['edited-exercise'] },
      }),
      storedOperation({
        kind: 'settings/update', entityId: 'user-1', idempotencyKey: 'user-1:settings',
        payload: { user_id: 'user-1', settings: { currentPlanId: 'edited-plan', timerAutoStart: true } },
      }),
      storedOperation({
        kind: 'coach_state/update', entityId: 'profile', idempotencyKey: 'user-1:coach-state:profile',
        payload: { user_id: 'user-1', key: 'profile', state: { goal: 'LOCAL GOAL' } },
      }),
      storedOperation({
        kind: 'session/insert', entityId: 'edited-exercise:pending-session', idempotencyKey: 'user-1:session-insert:edited-exercise:pending-session',
        payload: { user_id: 'user-1', exercise_id: 'edited-exercise', date: '2026-10-12T08:00:00.000Z' },
      }),
      storedOperation({
        kind: 'session/delete', entityId: 'deleted-log', idempotencyKey: 'user-1:session-delete:deleted-log',
        payload: { remote_id: 'deleted-log', user_id: 'user-1' },
      }),
    ];
    localStorage.setItem('reptrackMutationOutboxV1', JSON.stringify(operations));

    const results = {
      exercises: { data: [
        { id: 'edited-exercise', name: 'REMOTE OLD', muscle_group: 'Chest', type: 'Strength' },
        { id: 'deleted-exercise', name: 'RESURRECTED', muscle_group: 'Back', type: 'Strength' },
        { id: 'remote-only', name: 'Remote only', muscle_group: 'Legs', type: 'Strength' },
      ], error: null },
      workout_plans: { data: [
        { id: 'edited-plan', name: 'REMOTE PLAN', exercises: [], created_at: '2026-01-01' },
      ], error: null },
      exercise_logs: { data: [
        { id: 'deleted-log', exercise_id: 'edited-exercise', date: '2026-10-11T08:00:00.000Z', sets: [], best_set: null },
        { id: 'log-for-deleted-exercise', exercise_id: 'deleted-exercise', date: '2026-10-10T08:00:00.000Z', sets: [], best_set: null },
      ], error: null },
      user_settings: { data: { settings: { currentPlanId: 'remote-plan', timerAutoStart: false } }, error: null },
      workout_timer_state: { data: null, error: null },
      coach_state: { data: [{ user_id: 'user-1', key: 'profile', state: { goal: 'REMOTE GOAL' } }], error: null },
    };
    mockFrom.mockImplementation((table) => queryResult(results[table]));

    const { pullAll } = loadSyncModule();
    await pullAll('user-1');

    expect(JSON.parse(localStorage.getItem('exercises'))).toEqual([
      { id: 'edited-exercise', name: 'LOCAL NAME', muscleGroup: 'Chest', type: 'Strength' },
      { id: 'remote-only', name: 'Remote only', muscleGroup: 'Legs', type: 'Strength' },
    ]);
    expect(JSON.parse(localStorage.getItem('workoutPlans'))[0].name).toBe('LOCAL PLAN');
    expect(JSON.parse(localStorage.getItem('exerciseLogs'))['edited-exercise']).toEqual([
      expect.objectContaining({ clientSessionId: 'pending-session' }),
    ]);
    expect(JSON.parse(localStorage.getItem('exerciseLogs'))['deleted-exercise']).toBeUndefined();
    expect(localStorage.getItem('currentPlanId')).toBe('edited-plan');
    expect(localStorage.getItem('timerAutoStart')).toBe('true');
    expect(JSON.parse(localStorage.getItem('coach_profile')).goal).toBe('LOCAL GOAL');
  });

  test('flushes pending mutations before reading bulk snapshots', async () => {
    localStorage.setItem('reptrackMutationOutboxV1', JSON.stringify([
      storedOperation({
        status: 'pending', kind: 'plan/update', entityId: 'plan-1', idempotencyKey: 'user-1:plan:plan-1',
        payload: { id: 'plan-1', user_id: 'user-1', name: 'Latest', exercises: [] },
      }),
    ]));
    const calls = [];
    const emptyResults = {
      exercises: { data: [], error: null }, workout_plans: { data: [], error: null },
      exercise_logs: { data: [], error: null }, user_settings: { data: null, error: null },
      workout_timer_state: { data: null, error: null }, coach_state: { data: [], error: null },
    };
    mockFrom.mockImplementation((table) => {
      calls.push(table);
      if (table === 'workout_plans' && calls.length === 1) {
        return { upsert: jest.fn(async () => ({ error: null })) };
      }
      return queryResult(emptyResults[table]);
    });

    const { pullAll } = loadSyncModule();
    await pullAll('user-1');

    expect(calls[0]).toBe('workout_plans');
    expect(calls.slice(1)).toEqual([
      'exercises', 'workout_plans', 'exercise_logs', 'user_settings', 'workout_timer_state', 'coach_state',
    ]);
  });
});
