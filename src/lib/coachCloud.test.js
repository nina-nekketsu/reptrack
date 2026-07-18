const mockGetSession = jest.fn();
const mockFrom = jest.fn();

jest.mock('./supabase', () => ({
  supabaseUrl: 'https://example.supabase.co',
  supabase: {
    auth: { getSession: (...args) => mockGetSession(...args) },
    from: (...args) => mockFrom(...args),
  },
}));

import {
  beginCoachWorkout,
  endCoachWorkout,
  requestAiCoachMessage,
} from './coachCloud';

const authenticated = {
  data: {
    session: {
      access_token: 'test-access-token',
      user: { id: 'user-1' },
    },
  },
  error: null,
};

describe('cloud coaching lifecycle', () => {
  beforeEach(() => {
    mockGetSession.mockReset().mockResolvedValue(authenticated);
    mockFrom.mockReset();
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
  });

  test('starts one cloud workout keyed by the local active-session timestamp', async () => {
    const single = jest.fn().mockResolvedValue({ data: { id: 'coach-session-1' }, error: null });
    const select = jest.fn(() => ({ single }));
    const upsert = jest.fn(() => ({ select }));
    mockFrom.mockReturnValue({ upsert });

    await expect(beginCoachWorkout({
      planId: 'plan-a',
      planName: 'Plan A',
      startedAt: '2026-07-15T08:00:00.000Z',
      deviceId: 'device-a',
    })).resolves.toBe('coach-session-1');

    expect(mockFrom).toHaveBeenCalledWith('coach_workout_sessions');
    expect(upsert).toHaveBeenCalledWith({
      user_id: 'user-1',
      local_started_at: '2026-07-15T08:00:00.000Z',
      status: 'active',
      metadata: {
        planId: 'plan-a',
        planName: 'Plan A',
        deviceId: 'device-a',
      },
    }, { onConflict: 'user_id,local_started_at' });
  });

  test('ends only the matching authenticated cloud workout', async () => {
    const maybeSingle = jest.fn().mockResolvedValue({ data: { id: 'coach-session-1' }, error: null });
    const select = jest.fn(() => ({ maybeSingle }));
    const eqStarted = jest.fn(() => ({ select }));
    const eqUser = jest.fn(() => ({ eq: eqStarted }));
    const update = jest.fn(() => ({ eq: eqUser }));
    mockFrom.mockReturnValue({ update });

    await expect(endCoachWorkout(
      {
        planId: 'plan-a',
        planName: 'Plan A',
        startedAt: '2026-07-15T08:00:00.000Z',
        deviceId: 'device-a',
      },
      { completedExerciseIds: ['squat'] }
    )).resolves.toBe('coach-session-1');

    expect(eqUser).toHaveBeenCalledWith('user_id', 'user-1');
    expect(eqStarted).toHaveBeenCalledWith('local_started_at', '2026-07-15T08:00:00.000Z');
    expect(update).toHaveBeenCalledWith({
      status: 'completed',
      local_ended_at: expect.any(String),
      metadata: {
        planId: 'plan-a',
        planName: 'Plan A',
        deviceId: 'device-a',
        summary: { completedExerciseIds: ['squat'] },
      },
    });
  });

  test('requests feedback for the exact remote log and stable set identity', async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Keep your brace.', source: 'ai' }),
    });

    await expect(requestAiCoachMessage({
      exerciseLogId: 'log-1',
      exerciseId: 'squat',
      setIndex: 2,
      clientSetId: 'set-3',
      setFingerprint: 'fingerprint-3',
      localStartedAt: '2026-07-15T08:00:00.000Z',
    })).resolves.toEqual({ message: 'Keep your brace.', source: 'ai' });

    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.supabase.co/functions/v1/coach-generate',
      expect.objectContaining({ method: 'POST' })
    );
    const request = global.fetch.mock.calls[0][1];
    expect(request.headers.Authorization).toBe('Bearer test-access-token');
    expect(JSON.parse(request.body)).toEqual(expect.objectContaining({
      exerciseLogId: 'log-1',
      setIndex: 2,
      clientSetId: 'set-3',
      setFingerprint: 'fingerprint-3',
    }));
  });
});
