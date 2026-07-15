import {
  createMutationOutbox,
  MUTATION_OUTBOX_STORAGE_KEY,
} from './mutationOutbox';

describe('mutation outbox storage safety', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('loads an empty actionable queue from absent or malformed storage', () => {
    const absent = createMutationOutbox({ storage: localStorage });
    expect(absent.pendingCount()).toBe(0);
    expect(absent.listPending()).toEqual([]);

    localStorage.setItem(MUTATION_OUTBOX_STORAGE_KEY, '{not-json');
    const malformed = createMutationOutbox({ storage: localStorage });

    expect(malformed.pendingCount()).toBe(0);
    expect(malformed.listPending()).toEqual([]);
    expect(JSON.parse(localStorage.getItem(MUTATION_OUTBOX_STORAGE_KEY))).toEqual([]);
  });

  test('persists operations and coalesces duplicate idempotency keys with latest payload', () => {
    let tick = 100;
    const now = () => ++tick;
    const outbox = createMutationOutbox({ storage: localStorage, now });

    const first = outbox.enqueue({
      kind: 'exercise/update',
      entityId: 'exercise-1',
      idempotencyKey: 'user-1:exercise-1:revision-3',
      payload: { name: 'Bench' },
    });
    const duplicate = outbox.enqueue({
      kind: 'exercise/update',
      entityId: 'exercise-1',
      idempotencyKey: 'user-1:exercise-1:revision-3',
      payload: { name: 'Bench Press' },
    });

    expect(duplicate.id).toBe(first.id);
    expect(outbox.pendingCount()).toBe(1);
    expect(outbox.listPending()[0]).toEqual(expect.objectContaining({
      id: first.id,
      status: 'pending',
      attempts: 0,
      payload: { name: 'Bench Press' },
    }));

    const reloaded = createMutationOutbox({ storage: localStorage, now });
    expect(reloaded.listPending()).toEqual(outbox.listPending());
  });

  test('flushes in order, retains sanitized failures, and removes successful operations', async () => {
    const outbox = createMutationOutbox({ storage: localStorage, now: () => 123 });
    outbox.enqueue({
      kind: 'exercise/update',
      entityId: 'exercise-1',
      idempotencyKey: 'first',
      payload: { name: 'Bench' },
    });
    outbox.enqueue({
      kind: 'workout_plan/update',
      entityId: 'plan-1',
      idempotencyKey: 'second',
      payload: { name: 'Push' },
    });

    const seen = [];
    const result = await outbox.flush(async (operation) => {
      seen.push(operation.idempotencyKey);
      if (operation.idempotencyKey === 'first') {
        const error = new Error('network unavailable');
        error.code = 'NETWORK';
        error.token = 'must-not-persist';
        throw error;
      }
    });

    expect(seen).toEqual(['first', 'second']);
    expect(result).toEqual({ processed: 2, succeeded: 1, failed: 1, pending: 1 });
    expect(outbox.listPending()).toEqual([
      expect.objectContaining({
        idempotencyKey: 'first',
        status: 'failed',
        attempts: 1,
        lastError: { message: 'network unavailable', code: 'NETWORK' },
      }),
    ]);
    expect(localStorage.getItem(MUTATION_OUTBOX_STORAGE_KEY)).not.toContain('must-not-persist');
  });

  test('retry makes a failed operation pending and a successful replay removes it', async () => {
    const outbox = createMutationOutbox({ storage: localStorage, now: () => 456 });
    const operation = outbox.enqueue({
      kind: 'exercise_session/insert',
      entityId: 'session-local-1',
      idempotencyKey: 'session-local-1',
      payload: { reps: 10 },
    });

    await outbox.flush(async () => {
      throw new Error('offline');
    });

    const blockedExecutor = jest.fn();
    await expect(outbox.flush(blockedExecutor)).resolves.toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
      pending: 1,
    });
    expect(blockedExecutor).not.toHaveBeenCalled();

    expect(outbox.retry(operation.id)).toEqual(expect.objectContaining({
      id: operation.id,
      status: 'pending',
      lastError: null,
    }));

    const executor = jest.fn().mockResolvedValue({ remoteId: 'remote-1' });
    const result = await outbox.flush(executor);

    expect(executor).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ processed: 1, succeeded: 1, failed: 0, pending: 0 });
    expect(outbox.pendingCount()).toBe(0);
    expect(JSON.parse(localStorage.getItem(MUTATION_OUTBOX_STORAGE_KEY))).toEqual([]);
  });

  test('recovers an interrupted syncing operation as pending after reload', () => {
    localStorage.setItem(MUTATION_OUTBOX_STORAGE_KEY, JSON.stringify([{
      id: 'mutation-interrupted',
      kind: 'exercise/update',
      entityId: 'exercise-1',
      idempotencyKey: 'exercise-1:revision-4',
      payload: { name: 'Bench' },
      status: 'syncing',
      attempts: 1,
      lastError: null,
      createdAt: 1,
      updatedAt: 2,
    }]));

    const outbox = createMutationOutbox({ storage: localStorage });
    expect(outbox.listPending()).toEqual([
      expect.objectContaining({ id: 'mutation-interrupted', status: 'pending', attempts: 1 }),
    ]);
    expect(JSON.parse(localStorage.getItem(MUTATION_OUTBOX_STORAGE_KEY))[0].status).toBe('pending');
  });

  test('shares a single in-flight flush between concurrent callers', async () => {
    const outbox = createMutationOutbox({ storage: localStorage, now: () => 789 });
    outbox.enqueue({
      kind: 'exercise/update',
      entityId: 'exercise-1',
      idempotencyKey: 'single-flight',
      payload: { name: 'Bench' },
    });

    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const executor = jest.fn(async () => gate);
    const first = outbox.flush(executor);
    const second = outbox.flush(executor);

    expect(outbox.isFlushing()).toBe(true);
    expect(second).toBe(first);
    release();
    await expect(first).resolves.toEqual({ processed: 1, succeeded: 1, failed: 0, pending: 0 });
    expect(executor).toHaveBeenCalledTimes(1);
    expect(outbox.isFlushing()).toBe(false);
  });

  test('keeps a newer coalesced payload queued when an older payload succeeds in flight', async () => {
    const outbox = createMutationOutbox({ storage: localStorage, now: () => 900 });
    const firstOperation = outbox.enqueue({
      kind: 'exercise/update',
      entityId: 'exercise-1',
      idempotencyKey: 'exercise-1:revision-5',
      payload: { name: 'OLD' },
    });

    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const firstExecutor = jest.fn(async () => gate);
    const firstFlush = outbox.flush(firstExecutor);

    expect(firstExecutor).toHaveBeenCalledWith(expect.objectContaining({
      id: firstOperation.id,
      payload: { name: 'OLD' },
      status: 'syncing',
    }));
    const replacement = outbox.enqueue({
      kind: 'exercise/update',
      entityId: 'exercise-1',
      idempotencyKey: 'exercise-1:revision-5',
      payload: { name: 'NEW' },
    });
    expect(replacement.id).toBe(firstOperation.id);

    release();
    await expect(firstFlush).resolves.toEqual({
      processed: 1,
      succeeded: 1,
      failed: 0,
      pending: 1,
    });
    expect(outbox.listPending()[0]).toEqual(expect.objectContaining({
      id: firstOperation.id,
      status: 'pending',
      payload: { name: 'NEW' },
    }));

    const replayExecutor = jest.fn().mockResolvedValue(undefined);
    await outbox.flush(replayExecutor);
    expect(replayExecutor).toHaveBeenCalledWith(expect.objectContaining({
      payload: { name: 'NEW' },
    }));
    expect(outbox.pendingCount()).toBe(0);
  });
});
