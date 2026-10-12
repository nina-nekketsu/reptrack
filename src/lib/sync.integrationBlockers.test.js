const mockFrom = jest.fn();

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
  pullActiveWorkoutSession: jest.fn().mockResolvedValue(null),
  pushActiveWorkoutSession: jest.fn().mockResolvedValue(null),
}));

function loadSyncModule() {
  jest.resetModules();
  return require('./sync');
}

function pullQuery(result) {
  const query = {};
  query.select = jest.fn(() => query);
  query.eq = jest.fn(() => query);
  query.maybeSingle = jest.fn(async () => result);
  query.then = (resolve, reject) => Promise.resolve(result).then(resolve, reject);
  return query;
}

function installInMemoryRemote() {
  const remoteLogs = [];
  mockFrom.mockImplementation((table) => {
    if (table === 'exercise_logs') {
      const query = pullQuery({ data: remoteLogs, error: null });
      query.insert = jest.fn((payload) => {
        const row = { ...payload, id: `remote-${remoteLogs.length + 1}` };
        remoteLogs.push(row);
        return {
          select: () => ({
            single: async () => ({ data: row, error: null }),
          }),
        };
      });
      return query;
    }
    return pullQuery({
      data: table === 'user_settings' || table === 'workout_timer_state' ? null : [],
      error: null,
    });
  });
  return remoteLogs;
}

describe('session sync integration blockers', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFrom.mockReset();
  });

  test('pushes duplicate-workout metadata and restores it from remote without polluting bestSet', async () => {
    const remoteLogs = installInMemoryRemote();
    const first = {
      date: '2026-10-12T08:20:00.000Z',
      clientSessionId: 'client-first',
      workoutSessionStartedAt: '2026-10-12T08:00:00.000Z',
      workoutSessionOrderKey: 'bench:0',
      targetSetCount: 3,
      sets: [{ reps: 5, weight: 80 }],
      bestSet: { reps: 5, weight: 80 },
      totalReps: 5,
      totalVolume: 400,
    };
    const second = {
      ...first,
      date: '2026-10-12T08:40:00.000Z',
      clientSessionId: 'client-second',
      workoutSessionOrderKey: 'bench:1',
      sets: [{ reps: 6, weight: 70 }],
      bestSet: { reps: 6, weight: 70 },
      totalReps: 6,
      totalVolume: 420,
    };
    localStorage.setItem('exerciseLogs', JSON.stringify({ bench: [first, second] }));
    const { pullAll, pushSession } = loadSyncModule();

    await pushSession('bench', first, 'user-1');
    await pushSession('bench', second, 'user-1');

    expect(remoteLogs).toHaveLength(2);
    expect(remoteLogs.map((row) => row.best_set)).toEqual([
      expect.objectContaining({
        reps: 5,
        weight: 80,
        sessionTargetSetCount: 3,
        sessionClientSessionId: 'client-first',
        sessionWorkoutSessionStartedAt: '2026-10-12T08:00:00.000Z',
        sessionWorkoutSessionOrderKey: 'bench:0',
      }),
      expect.objectContaining({
        sessionClientSessionId: 'client-second',
        sessionWorkoutSessionOrderKey: 'bench:1',
      }),
    ]);

    localStorage.removeItem('exerciseLogs');
    await pullAll('user-1');

    expect(JSON.parse(localStorage.getItem('exerciseLogs')).bench).toEqual([
      expect.objectContaining({
        remoteId: 'remote-1',
        clientSessionId: 'client-first',
        workoutSessionStartedAt: '2026-10-12T08:00:00.000Z',
        workoutSessionOrderKey: 'bench:0',
        targetSetCount: 3,
        bestSet: { reps: 5, weight: 80 },
      }),
      expect.objectContaining({
        remoteId: 'remote-2',
        clientSessionId: 'client-second',
        workoutSessionStartedAt: '2026-10-12T08:00:00.000Z',
        workoutSessionOrderKey: 'bench:1',
        bestSet: { reps: 6, weight: 70 },
      }),
    ]);
  });

  test('keeps legacy plain best_set objects unchanged on decode', () => {
    const { deserializeSessionBestSet } = loadSyncModule();

    expect(deserializeSessionBestSet({ reps: 8, weight: 100 })).toEqual({
      bestSet: { reps: 8, weight: 100 },
    });
  });

  test('serializes session metadata for bulk inserts and remote updates', async () => {
    const bulkInsert = jest.fn((rows) => ({
      select: async () => ({ data: [], error: null }),
    }));
    const update = jest.fn((payload) => {
      const query = {};
      query.eq = jest.fn(() => query);
      query.then = (resolve, reject) => Promise.resolve({ error: null }).then(resolve, reject);
      return query;
    });
    mockFrom
      .mockImplementationOnce(() => ({ insert: bulkInsert }))
      .mockImplementationOnce(() => ({ update }));
    const session = {
      date: '2026-10-12T08:20:00.000Z',
      clientSessionId: 'shared-serializer',
      workoutSessionStartedAt: '2026-10-12T08:00:00.000Z',
      workoutSessionOrderKey: 'bench:1',
      sets: [{ reps: 5, weight: 80 }],
      bestSet: { reps: 5, weight: 80 },
      totalReps: 5,
      totalVolume: 400,
    };
    localStorage.setItem('exerciseLogs', JSON.stringify({ bench: [session] }));
    const { pushLogs, updateRemoteSession } = loadSyncModule();

    await pushLogs('user-1');
    await updateRemoteSession('remote-1', 'bench', session, 'user-1');

    const expectedEnvelope = expect.objectContaining({
      reps: 5,
      weight: 80,
      sessionClientSessionId: 'shared-serializer',
      sessionWorkoutSessionStartedAt: '2026-10-12T08:00:00.000Z',
      sessionWorkoutSessionOrderKey: 'bench:1',
    });
    expect(bulkInsert).toHaveBeenCalledWith([
      expect.objectContaining({ best_set: expectedEnvelope }),
    ]);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({
      best_set: expectedEnvelope,
    }));
  });

  test.each([
    ['stable client id', { clientSessionId: 'client-stable' }],
    ['legacy workout identity', {
      workoutSessionStartedAt: '2026-10-12T08:00:00.000Z',
      workoutSessionOrderKey: 'bench:1',
    }],
  ])('delayed executor tags only the newest local copy by %s', async (_label, identity) => {
    let releaseInsert;
    const insertGate = new Promise((resolve) => { releaseInsert = resolve; });
    const insert = jest.fn(() => ({
      select: () => ({ single: async () => insertGate }),
    }));
    mockFrom.mockImplementation(() => ({ insert }));
    const date = '2026-10-12T08:20:00.000Z';
    const stale = {
      date,
      ...identity,
      sets: [{ reps: 5, weight: 80 }],
      totalReps: 5,
      totalVolume: 400,
    };
    localStorage.setItem('exerciseLogs', JSON.stringify({ bench: [stale] }));
    const { pushSession } = loadSyncModule();

    const pushing = pushSession('bench', stale, 'user-1');
    const newest = {
      ...stale,
      sets: [{ reps: 6, weight: 80 }],
      totalReps: 6,
      totalVolume: 480,
    };
    localStorage.setItem('exerciseLogs', JSON.stringify({ bench: [stale, newest] }));
    releaseInsert({ data: { id: 'remote-newest' }, error: null });

    await expect(pushing).resolves.toBe('remote-newest');
    const saved = JSON.parse(localStorage.getItem('exerciseLogs')).bench;
    expect(saved[0]).toEqual(stale);
    expect(saved[1]).toEqual({ ...newest, remoteId: 'remote-newest' });
  });
});
