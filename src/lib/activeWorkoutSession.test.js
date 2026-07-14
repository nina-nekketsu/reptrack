import {
  ACTIVE_WORKOUT_CHANGED_EVENT,
  ACTIVE_WORKOUT_KEY,
  createActiveWorkoutSession,
  endActiveWorkoutSession,
  getOrCreateDeviceId,
  getStoredVisibleActiveWorkoutSession,
  getVisibleActiveWorkoutSession,
  mergeActiveWorkoutSessions,
  normalizeActiveWorkoutSession,
  readStoredActiveWorkoutSession,
  saveActiveWorkoutSession,
} from './activeWorkoutSession';

const active = (overrides = {}) => ({
  planId: 'plan-a',
  planName: 'Plan A',
  startedAt: '2026-07-14T08:00:00.000Z',
  updatedAt: '2026-07-14T08:00:00.000Z',
  status: 'active',
  endedAt: null,
  deviceId: 'device-a',
  ...overrides,
});

describe('active workout session lifecycle', () => {
  test('normalizes a legacy session as active without discarding its fields', () => {
    const legacy = {
      planId: 'legacy-plan',
      planName: 'Legacy',
      startedAt: '2026-07-14T07:00:00.000Z',
    };

    expect(normalizeActiveWorkoutSession(legacy)).toEqual({
      ...legacy,
      updatedAt: legacy.startedAt,
      status: 'active',
      endedAt: null,
      deviceId: null,
    });
  });

  test('backfills every required field on sparse legacy records', () => {
    const normalized = normalizeActiveWorkoutSession({
      planId: 'legacy-plan',
      startedAt: '2026-07-14T07:00:00.000Z',
    });

    expect(normalized).toEqual({
      planId: 'legacy-plan',
      planName: '',
      startedAt: '2026-07-14T07:00:00.000Z',
      updatedAt: '2026-07-14T07:00:00.000Z',
      status: 'active',
      endedAt: null,
      deviceId: null,
    });
  });

  test('creates a fully stamped active session', () => {
    expect(createActiveWorkoutSession({
      planId: 'plan-a',
      planName: 'Plan A',
      now: '2026-07-14T08:00:00.000Z',
      deviceId: 'device-a',
    })).toEqual(active());
  });

  test('ending a workout creates a tombstone instead of deleting it', () => {
    expect(endActiveWorkoutSession(active(), '2026-07-14T09:00:00.000Z')).toEqual(
      active({
        updatedAt: '2026-07-14T09:00:00.000Z',
        status: 'ended',
        endedAt: '2026-07-14T09:00:00.000Z',
      })
    );
  });

  test('newest updatedAt wins across devices', () => {
    const local = active({ updatedAt: '2026-07-14T08:30:00.000Z' });
    const remote = active({
      deviceId: 'device-b',
      updatedAt: '2026-07-14T08:31:00.000Z',
    });

    expect(mergeActiveWorkoutSessions(local, remote)).toEqual(remote);
    expect(mergeActiveWorkoutSessions(remote, local)).toEqual(remote);
  });

  test('ended wins an equal-timestamp tie so a workout cannot resurrect', () => {
    const current = active({ updatedAt: '2026-07-14T09:00:00.000Z' });
    const ended = active({
      updatedAt: '2026-07-14T09:00:00.000Z',
      status: 'ended',
      endedAt: '2026-07-14T09:00:00.000Z',
    });

    expect(mergeActiveWorkoutSessions(current, ended)).toEqual(ended);
    expect(mergeActiveWorkoutSessions(ended, current)).toEqual(ended);
  });

  test('only active status is exposed to the UI as resumable', () => {
    expect(getVisibleActiveWorkoutSession(active())).toEqual(active());
    expect(getVisibleActiveWorkoutSession(active({ status: 'ended' }))).toBeNull();
    expect(getVisibleActiveWorkoutSession(null)).toBeNull();
  });

  test('invalid records normalize to null', () => {
    expect(normalizeActiveWorkoutSession(null)).toBeNull();
    expect(normalizeActiveWorkoutSession({ startedAt: '2026-07-14T08:00:00.000Z' })).toBeNull();
    expect(normalizeActiveWorkoutSession({ planId: 'plan-a' })).toBeNull();
  });
});

describe('active workout session local store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('writes a normalized session and announces the change', () => {
    const listener = jest.fn();
    window.addEventListener(ACTIVE_WORKOUT_CHANGED_EVENT, listener);

    const stored = saveActiveWorkoutSession({
      action: 'start',
      planId: 'legacy-plan',
      planName: 'Legacy',
      now: '2026-07-14T07:00:00.000Z',
      deviceId: 'device-a',
    });

    expect(stored.status).toBe('active');
    expect(JSON.parse(localStorage.getItem(ACTIVE_WORKOUT_KEY))).toEqual(stored);
    expect(listener).toHaveBeenCalledTimes(1);

    window.removeEventListener(ACTIVE_WORKOUT_CHANGED_EVENT, listener);
  });

  test('reads malformed storage safely as null', () => {
    localStorage.setItem(ACTIVE_WORKOUT_KEY, '{not-json');
    expect(readStoredActiveWorkoutSession()).toBeNull();
  });

  test('creates one stable browser device id and reuses it', () => {
    const randomUUID = jest.fn(() => 'device-generated');

    expect(getOrCreateDeviceId(localStorage, randomUUID)).toBe('device-generated');
    expect(getOrCreateDeviceId(localStorage, randomUUID)).toBe('device-generated');
    expect(randomUUID).toHaveBeenCalledTimes(1);
  });

  test('finishing the stored workout preserves an ended tombstone', () => {
    saveActiveWorkoutSession({
      action: 'start',
      planId: 'plan-a',
      planName: 'Plan A',
      now: '2026-07-14T08:00:00.000Z',
      deviceId: 'device-a',
    });

    const ended = saveActiveWorkoutSession({
      action: 'end',
      now: '2026-07-14T09:00:00.000Z',
    });

    expect(readStoredActiveWorkoutSession()).toEqual(ended);
    expect(ended.status).toBe('ended');
    expect(ended.endedAt).toBe('2026-07-14T09:00:00.000Z');
    expect(getStoredVisibleActiveWorkoutSession()).toBeNull();
  });

  test('ending a legacy session backfills its persistent browser device id', () => {
    getOrCreateDeviceId(localStorage, () => 'device-generated');
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify({
      planId: 'legacy-plan',
      startedAt: '2026-07-14T08:00:00.000Z',
    }));

    const ended = saveActiveWorkoutSession({
      action: 'end',
      now: '2026-07-14T09:00:00.000Z',
    });

    expect(ended.deviceId).toBe('device-generated');
    expect(ended.planName).toBe('');
    expect(JSON.parse(localStorage.getItem(ACTIVE_WORKOUT_KEY))).toEqual(ended);
  });
});
