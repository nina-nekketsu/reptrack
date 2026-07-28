const mockUpsert = jest.fn();
const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));
const mockIncrementSyncFailure = jest.fn();

jest.mock('./clientDiagnosticsRuntime', () => ({
  clientDiagnostics: {
    incrementSyncFailure: (...args) => mockIncrementSyncFailure(...args),
  },
}));

jest.mock('./supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

function loadSyncModule() {
  jest.resetModules();
  return require('./sync');
}

describe('exercise mutation outbox integration', () => {
  beforeEach(() => {
    localStorage.clear();
    mockFrom.mockReset();
    mockFrom.mockImplementation(() => ({ upsert: mockUpsert }));
    mockUpsert.mockReset();
    mockIncrementSyncFailure.mockReset();
  });

  test('retains a failed exercise upsert and replays it only after explicit retry', async () => {
    mockUpsert.mockResolvedValueOnce({
      error: Object.assign(new Error('TypeError: Failed to fetch'), { code: '' }),
    });
    const {
      flushPendingMutations,
      getSyncSnapshot,
      listPendingMutations,
      pushExercise,
      retryPendingMutation,
    } = loadSyncModule();

    await expect(pushExercise({
      id: 'bench-1',
      name: 'Bench Press',
      muscleGroup: 'Chest',
      type: 'Strength',
      updatedAt: '2026-07-15T20:00:00.000Z',
    }, 'user-1')).resolves.toEqual({
      processed: 1,
      succeeded: 0,
      failed: 1,
      pending: 1,
    });

    expect(mockFrom).toHaveBeenCalledWith('exercises');
    expect(mockIncrementSyncFailure).toHaveBeenCalledTimes(1);
    expect(mockIncrementSyncFailure).toHaveBeenCalledWith('offline');
    expect(mockUpsert).toHaveBeenCalledWith({
      id: 'bench-1',
      user_id: 'user-1',
      name: 'Bench Press',
      muscle_group: 'Chest',
      type: 'Strength',
    }, { onConflict: 'id,user_id' });

    const [failed] = listPendingMutations();
    expect(getSyncSnapshot()).toEqual(expect.objectContaining({
      pendingCount: 0,
      failedCount: 1,
      syncingCount: 0,
      lastSuccessfulSyncAt: null,
    }));
    expect(failed).toEqual(expect.objectContaining({
      kind: 'exercise/update',
      entityId: 'bench-1',
      status: 'failed',
      attempts: 1,
      lastError: { message: 'TypeError: Failed to fetch', code: 'UNKNOWN' },
    }));

    const secondExecutorCall = jest.fn();
    mockUpsert.mockImplementationOnce(async (...args) => {
      secondExecutorCall(...args);
      return { error: null };
    });
    retryPendingMutation(failed.id);
    await expect(flushPendingMutations()).resolves.toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
      pending: 0,
    });

    expect(secondExecutorCall).toHaveBeenCalledTimes(1);
    expect(listPendingMutations()).toEqual([]);
    expect(getSyncSnapshot()).toEqual(expect.objectContaining({
      pendingCount: 0,
      failedCount: 0,
      syncingCount: 0,
      lastSuccessfulSyncAt: expect.any(String),
    }));
  });

  test('removes a successful queued exercise mutation and does not replay it', async () => {
    mockUpsert.mockResolvedValue({ error: null });
    const { flushPendingMutations, listPendingMutations, pushExercise } = loadSyncModule();

    await pushExercise({ id: 42, name: 'Row', muscleGroup: 'Back' }, 'user-2');
    expect(listPendingMutations()).toEqual([]);

    await expect(flushPendingMutations()).resolves.toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
      pending: 0,
    });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  test('drains a newer exercise edit that arrives while the prior edit is in flight', async () => {
    let releaseFirst;
    const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
    mockUpsert
      .mockImplementationOnce(async () => firstGate)
      .mockResolvedValueOnce({ error: null });
    const { listPendingMutations, pushExercise } = loadSyncModule();

    const firstPush = pushExercise({ id: 'row-1', name: 'OLD', muscleGroup: 'Back' }, 'user-3');
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const secondPush = pushExercise({ id: 'row-1', name: 'NEW', muscleGroup: 'Back' }, 'user-3');

    releaseFirst({ error: null });
    await Promise.all([firstPush, secondPush]);

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'row-1', name: 'NEW' }),
      { onConflict: 'id,user_id' }
    );
    expect(listPendingMutations()).toEqual([]);
  });

  test('a newer edit supersedes a retained failed edit for the same exercise', async () => {
    mockUpsert
      .mockResolvedValueOnce({ error: new Error('offline') })
      .mockResolvedValueOnce({ error: null });
    const { listPendingMutations, pushExercise } = loadSyncModule();

    await pushExercise({ id: 'press-1', name: 'Old name', muscleGroup: 'Chest' }, 'user-4');
    expect(listPendingMutations()).toHaveLength(1);

    await pushExercise({ id: 'press-1', name: 'New name', muscleGroup: 'Chest' }, 'user-4');

    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: 'press-1', name: 'New name' }),
      { onConflict: 'id,user_id' }
    );
    expect(listPendingMutations()).toEqual([]);
  });

  test('bulk exercise sync skips entities already represented by retained outbox work', async () => {
    mockUpsert.mockResolvedValueOnce({ error: new Error('offline') });
    const { pushExercise, pushExercises } = loadSyncModule();
    localStorage.setItem('exercises', JSON.stringify([
      { id: 'queued-1', name: 'Queued press', muscleGroup: 'Chest' },
    ]));

    await pushExercise({ id: 'queued-1', name: 'Queued press', muscleGroup: 'Chest' }, 'user-5');
    expect(mockUpsert).toHaveBeenCalledTimes(1);

    mockUpsert.mockResolvedValueOnce({ error: null });
    await pushExercises('user-5');

    expect(mockUpsert).toHaveBeenCalledTimes(1);
  });

  test('attaches remote ids by clientSessionId when timestamps are identical', async () => {
    const timestamp = '2026-07-28T12:00:00.000Z';
    const sessions = [
      { date: timestamp, clientSessionId: 'local-a', sets: [{ reps: 5, weight: 50 }], totalReps: 5, totalVolume: 250 },
      { date: timestamp, clientSessionId: 'local-b', sets: [{ reps: 6, weight: 60 }], totalReps: 6, totalVolume: 360 },
    ];
    localStorage.setItem('exerciseLogs', JSON.stringify({ bench: sessions }));
    const insertedPayloads = [];
    const remoteIds = ['remote-a', 'remote-b'];
    const insert = jest.fn((payload) => {
      insertedPayloads.push(payload);
      const remoteId = remoteIds.shift();
      return { select: () => ({ single: async () => ({ data: { id: remoteId }, error: null }) }) };
    });
    mockFrom.mockImplementation(() => ({ insert }));
    const { pushSession } = loadSyncModule();

    await pushSession('bench', sessions[0], 'user-1');
    await pushSession('bench', sessions[1], 'user-1');

    expect(insertedPayloads).toHaveLength(2);
    expect(insertedPayloads.every((payload) => !Object.prototype.hasOwnProperty.call(payload, '_client_session_id'))).toBe(true);
    const saved = JSON.parse(localStorage.getItem('exerciseLogs')).bench;
    expect(saved.map((session) => [session.clientSessionId, session.remoteId])).toEqual([
      ['local-a', 'remote-a'],
      ['local-b', 'remote-b'],
    ]);
  });

  test('routes same-timestamp bulk sessions through identity-safe single inserts', async () => {
    const timestamp = '2026-07-28T12:00:00.000Z';
    const sessions = [
      { date: timestamp, clientSessionId: 'bulk-a', sets: [{ reps: 5, weight: 50 }], totalReps: 5, totalVolume: 250 },
      { date: timestamp, clientSessionId: 'bulk-b', sets: [{ reps: 6, weight: 60 }], totalReps: 6, totalVolume: 360 },
    ];
    localStorage.setItem('exerciseLogs', JSON.stringify({ bench: sessions }));
    const remoteIds = ['bulk-remote-a', 'bulk-remote-b'];
    const insert = jest.fn((payload) => {
      expect(Array.isArray(payload)).toBe(false);
      const remoteId = remoteIds.shift();
      return { select: () => ({ single: async () => ({ data: { id: remoteId }, error: null }) }) };
    });
    mockFrom.mockImplementation(() => ({ insert }));
    const { pushLogs } = loadSyncModule();

    await pushLogs('user-1');

    expect(insert).toHaveBeenCalledTimes(2);
    const saved = JSON.parse(localStorage.getItem('exerciseLogs')).bench;
    expect(saved.map((session) => [session.clientSessionId, session.remoteId])).toEqual([
      ['bulk-a', 'bulk-remote-a'],
      ['bulk-b', 'bulk-remote-b'],
    ]);
  });

  test('retains and retries a failed update to an already-synced workout session', async () => {
    let updateError = Object.assign(new Error('TypeError: Failed to fetch'), { code: '' });
    const eqExercise = jest.fn(async () => ({ error: updateError }));
    const eqUser = jest.fn(() => ({ eq: eqExercise }));
    const eqId = jest.fn(() => ({ eq: eqUser }));
    const update = jest.fn(() => ({ eq: eqId }));
    mockFrom.mockImplementation(() => ({ update }));
    const {
      flushPendingMutations,
      listPendingMutations,
      retryPendingMutation,
      updateRemoteSession,
    } = loadSyncModule();

    const editedSession = {
      sets: [{ reps: 8, weight: 80, done: true }],
      bestSet: { reps: 8, weight: 80 },
      totalReps: 8,
      totalVolume: 640,
    };

    await expect(updateRemoteSession(
      'remote-log-1',
      'bench-1',
      editedSession,
      'user-1'
    )).resolves.toEqual({
      processed: 1,
      succeeded: 0,
      failed: 1,
      pending: 1,
    });

    const [failed] = listPendingMutations();
    expect(failed).toEqual(expect.objectContaining({
      kind: 'session/update',
      entityId: 'remote-log-1',
      status: 'failed',
      attempts: 1,
    }));
    expect(update).toHaveBeenCalledWith({
      sets: editedSession.sets,
      best_set: editedSession.bestSet,
      total_reps: 8,
      total_volume: 640,
    });
    expect(eqId).toHaveBeenCalledWith('id', 'remote-log-1');
    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eqExercise).toHaveBeenCalledWith('exercise_id', 'bench-1');

    updateError = null;
    retryPendingMutation(failed.id);
    await expect(flushPendingMutations()).resolves.toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
      pending: 0,
    });
    expect(listPendingMutations()).toEqual([]);
    expect(update).toHaveBeenCalledTimes(2);
  });
});
