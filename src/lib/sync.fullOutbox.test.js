const mockFrom = jest.fn();
const mockIncrementSyncFailure = jest.fn();
const mockRecordError = jest.fn();

jest.mock('./clientDiagnosticsRuntime', () => ({
  clientDiagnostics: {
    incrementSyncFailure: (...args) => mockIncrementSyncFailure(...args),
    recordError: (...args) => mockRecordError(...args),
  },
}));

jest.mock('./supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

jest.mock('./activeWorkoutSessionSync', () => ({
  pullActiveWorkoutSession: jest.fn(),
  pushActiveWorkoutSession: jest.fn().mockResolvedValue(null),
}));

function chain(result = { error: null, data: null }) {
  const api = {};
  api.insert = jest.fn(() => api);
  api.upsert = jest.fn(() => api);
  api.update = jest.fn(() => api);
  api.delete = jest.fn(() => api);
  api.select = jest.fn(() => api);
  api.single = jest.fn(async () => result);
  api.maybeSingle = jest.fn(async () => result);
  api.eq = jest.fn(() => api);
  api.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return api;
}

function loadSyncModule() {
  jest.resetModules();
  return require('./sync');
}

describe('full durable mutation outbox', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFrom.mockReset();
    mockIncrementSyncFailure.mockReset();
    mockRecordError.mockReset();
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  test('queues stable FIFO mutations for log insert, plan, settings, and coach state', async () => {
    const calls = [];
    mockFrom.mockImplementation((table) => {
      const api = chain({ error: null, data: { id: 'remote-log-1' } });
      ['insert', 'upsert'].forEach((method) => {
        api[method].mockImplementation((payload, options) => {
          calls.push({ table, method, payload, options });
          return api;
        });
      });
      return api;
    });
    const {
      listPendingMutations,
      pushCoachState,
      pushPlan,
      pushSession,
      pushSettings,
    } = loadSyncModule();

    localStorage.setItem('currentPlanId', 'plan-1');
    localStorage.setItem('timerAutoStart', 'true');
    localStorage.setItem('timerRestDefaults', JSON.stringify({ bench: 120 }));
    await pushSession('bench', {
      date: '2026-07-18T08:00:00.000Z',
      sets: [{ reps: 5, weight: 100 }],
      bestSet: { reps: 5, weight: 100 },
      totalReps: 5,
      totalVolume: 500,
    }, 'user-1');
    await pushPlan({ id: 'plan-1', name: 'Push', exercises: ['bench'] }, 'user-1');
    await pushSettings('user-1');
    await pushCoachState('profile', { onboardingComplete: true }, 'user-1');

    expect(listPendingMutations()).toEqual([]);
    expect(calls.map((call) => `${call.method}:${call.table}`)).toEqual([
      'insert:exercise_logs',
      'upsert:workout_plans',
      'upsert:user_settings',
      'upsert:coach_state',
    ]);
    expect(calls[0].payload).toEqual(expect.objectContaining({
      user_id: 'user-1',
      exercise_id: 'bench',
      date: '2026-07-18T08:00:00.000Z',
    }));
    expect(calls[1].options).toEqual({ onConflict: 'id,user_id' });
    expect(calls[2].payload).toEqual({
      user_id: 'user-1',
      settings: {
        currentPlanId: 'plan-1',
        timerAutoStart: true,
        timerRestDefaults: { bench: 120 },
      },
    });
    expect(calls[3].payload).toEqual({
      user_id: 'user-1',
      key: 'profile',
      state: { onboardingComplete: true },
    });
  });

  test('dedupes log inserts by user, exercise, and date with the latest payload', async () => {
    const insert = jest.fn();
    mockFrom.mockImplementation(() => {
      const api = chain({ error: null, data: { id: 'remote-log-1' } });
      api.insert.mockImplementation((payload) => {
        insert(payload);
        return api;
      });
      return api;
    });
    const { pushSession } = loadSyncModule();

    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    mockFrom.mockImplementationOnce(() => {
      const api = chain({ error: null, data: { id: 'remote-log-1' } });
      api.insert.mockImplementation((payload) => {
        insert(payload);
        return api;
      });
      api.single.mockImplementation(async () => gate);
      return api;
    });

    const first = pushSession('bench', {
      date: '2026-07-18T08:00:00.000Z',
      sets: [{ reps: 5, weight: 100 }],
      totalReps: 5,
      totalVolume: 500,
    }, 'user-1');
    const second = pushSession('bench', {
      date: '2026-07-18T08:00:00.000Z',
      sets: [{ reps: 6, weight: 100 }],
      totalReps: 6,
      totalVolume: 600,
    }, 'user-1');

    release({ error: null, data: { id: 'remote-log-1' } });
    await Promise.all([first, second]);

    expect(insert).toHaveBeenCalledTimes(2);
    expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({
      sets: [{ reps: 6, weight: 100 }],
      total_reps: 6,
      total_volume: 600,
    }));
  });

  test('queues scoped deletes with stable remote ownership filters', async () => {
    const eqs = [];
    mockFrom.mockImplementation(() => {
      const api = chain({ error: null });
      api.eq.mockImplementation((column, value) => {
        eqs.push([column, value]);
        return api;
      });
      return api;
    });
    const { deleteRemoteExercise, deleteRemoteSession } = loadSyncModule();

    await deleteRemoteSession('remote-log-1', 'user-1');
    await deleteRemoteExercise('bench', 'user-1');

    expect(eqs).toEqual([
      ['id', 'remote-log-1'],
      ['user_id', 'user-1'],
      ['exercise_id', 'bench'],
      ['user_id', 'user-1'],
      ['id', 'bench'],
      ['user_id', 'user-1'],
    ]);
  });

  test('auth-expired pauses the queue until manual retry and records diagnostics once', async () => {
    mockFrom.mockImplementation(() => {
      const api = chain({ error: Object.assign(new Error('JWT expired'), { code: 'JWT_EXPIRED' }) });
      return api;
    });
    const {
      flushPendingMutations,
      getSyncSnapshot,
      listPendingMutations,
      pushPlan,
      retryPendingMutation,
    } = loadSyncModule();

    await expect(pushPlan({ id: 'plan-1', name: 'Push', exercises: [] }, 'user-1'))
      .resolves.toEqual(expect.objectContaining({ failed: 1, pending: 1 }));
    expect(getSyncSnapshot().authExpired).toBe(true);
    expect(mockIncrementSyncFailure).toHaveBeenCalledWith('auth-expired');
    expect(mockRecordError).toHaveBeenCalledWith(expect.any(Error), {
      source: 'sync',
      category: 'auth-expired',
    });

    await expect(flushPendingMutations()).resolves.toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
      pending: 1,
      paused: 'auth-expired',
    });

    mockFrom.mockImplementation(() => chain({ error: null }));
    retryPendingMutation(listPendingMutations()[0].id);
    await expect(flushPendingMutations()).resolves.toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
      pending: 0,
    });
  });

  test('login, online, and manual retry share a single in-flight outbox flush', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    mockFrom.mockImplementation(() => {
      const api = chain({ error: null });
      api.upsert.mockImplementation(() => api);
      api.then = (resolve, reject) => gate.then(() => ({ error: null })).then(resolve, reject);
      return api;
    });
    const { flushPendingMutations, pushPlan } = loadSyncModule();

    const first = pushPlan({ id: 'plan-1', name: 'Push', exercises: [] }, 'user-1');
    const second = flushPendingMutations();
    const third = flushPendingMutations();

    expect(second).toBe(third);
    release();
    await Promise.all([first, second, third]);
    expect(mockFrom).toHaveBeenCalledTimes(1);
  });
});
