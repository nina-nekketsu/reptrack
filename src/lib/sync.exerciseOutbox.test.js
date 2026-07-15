const mockUpsert = jest.fn();
const mockFrom = jest.fn(() => ({ upsert: mockUpsert }));

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
  });

  test('retains a failed exercise upsert and replays it only after explicit retry', async () => {
    mockUpsert.mockResolvedValueOnce({
      error: Object.assign(new Error('network unavailable'), { code: 'NETWORK' }),
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
      lastError: { message: 'network unavailable', code: 'NETWORK' },
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
});
