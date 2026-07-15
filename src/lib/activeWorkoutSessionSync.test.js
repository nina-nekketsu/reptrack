import {
  pullActiveWorkoutSession,
  pushActiveWorkoutSession,
} from './activeWorkoutSessionSync';
import {
  readStoredActiveWorkoutSession,
  saveActiveWorkoutSession,
} from './activeWorkoutSession';

function memoryStorage() {
  const values = new Map();
  return {
    getItem: jest.fn((key) => values.has(key) ? values.get(key) : null),
    setItem: jest.fn((key, value) => values.set(key, String(value))),
    removeItem: jest.fn((key) => values.delete(key)),
  };
}

function pullClient(result) {
  const maybeSingle = jest.fn().mockResolvedValue(result);
  const eq = jest.fn(() => ({ maybeSingle }));
  const select = jest.fn(() => ({ eq }));
  const from = jest.fn(() => ({ select }));
  return { client: { from }, from, select, eq, maybeSingle };
}

describe('dedicated active workout session sync', () => {
  test('pull applies a newer remote ended tombstone locally', async () => {
    const storage = memoryStorage();
    saveActiveWorkoutSession({
      action: 'start',
      planId: 'plan-a',
      planName: 'Plan A',
      now: '2026-07-14T08:00:00.000Z',
      deviceId: 'device-a',
    }, storage);

    const remote = {
      planId: 'plan-a',
      planName: 'Plan A',
      startedAt: '2026-07-14T08:00:00.000Z',
      updatedAt: '2026-07-14T09:00:00.000Z',
      status: 'ended',
      endedAt: '2026-07-14T09:00:00.000Z',
      deviceId: 'device-b',
    };
    const { client, from } = pullClient({ data: { session: remote }, error: null });

    await expect(pullActiveWorkoutSession(client, 'user-1', storage)).resolves.toEqual(remote);
    expect(from).toHaveBeenCalledWith('active_sessions');
    expect(readStoredActiveWorkoutSession(storage)).toEqual(remote);
  });

  test('pull keeps a newer local ended tombstone over stale remote active state', async () => {
    const storage = memoryStorage();
    saveActiveWorkoutSession({
      action: 'start',
      planId: 'plan-a',
      planName: 'Plan A',
      now: '2026-07-14T08:00:00.000Z',
      deviceId: 'device-a',
    }, storage);
    saveActiveWorkoutSession({
      action: 'end',
      now: '2026-07-14T10:00:00.000Z',
    }, storage);

    const staleRemote = {
      planId: 'plan-a',
      planName: 'Plan A',
      startedAt: '2026-07-14T08:00:00.000Z',
      updatedAt: '2026-07-14T09:00:00.000Z',
      status: 'active',
      endedAt: null,
      deviceId: 'device-b',
    };
    const { client } = pullClient({ data: { session: staleRemote }, error: null });

    const winner = await pullActiveWorkoutSession(client, 'user-1', storage);
    expect(winner.status).toBe('ended');
    expect(winner.updatedAt).toBe('2026-07-14T10:00:00.000Z');
  });

  test('push uses the atomic merge RPC and reconciles the returned winner', async () => {
    const storage = memoryStorage();
    const local = saveActiveWorkoutSession({
      action: 'start',
      planId: 'plan-a',
      planName: 'Plan A',
      now: '2026-07-14T08:00:00.000Z',
      deviceId: 'device-a',
    }, storage);
    const remoteWinner = {
      ...local,
      updatedAt: '2026-07-14T09:00:00.000Z',
      status: 'ended',
      endedAt: '2026-07-14T09:00:00.000Z',
      deviceId: 'device-b',
    };
    const rpc = jest.fn().mockResolvedValue({ data: remoteWinner, error: null });

    await expect(pushActiveWorkoutSession({ rpc }, 'user-1', storage)).resolves.toEqual(remoteWinner);
    expect(rpc).toHaveBeenCalledWith('merge_active_session', {
      p_user_id: 'user-1',
      p_session: local,
    });
    expect(readStoredActiveWorkoutSession(storage)).toEqual(remoteWinner);
  });

  test('push is a no-op when there is no local lifecycle record', async () => {
    const rpc = jest.fn();
    await expect(pushActiveWorkoutSession({ rpc }, 'user-1', memoryStorage())).resolves.toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  test('transport errors are surfaced to the caller', async () => {
    const storage = memoryStorage();
    saveActiveWorkoutSession({
      action: 'start',
      planId: 'plan-a',
      planName: 'Plan A',
      now: '2026-07-14T08:00:00.000Z',
      deviceId: 'device-a',
    }, storage);
    const error = new Error('network down');
    const rpc = jest.fn().mockResolvedValue({ data: null, error });

    await expect(pushActiveWorkoutSession({ rpc }, 'user-1', storage)).rejects.toBe(error);
  });
});
