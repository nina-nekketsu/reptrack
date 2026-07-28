import { deleteSession, getSetRepFeedback, getSessionRepFeedback, saveLogs } from './exerciseHelpers';

describe('saveLogs', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('returns true only after logs are durably written', () => {
    const logs = { squat: [{ date: '2026-07-20T12:00:00.000Z', sets: [] }] };

    expect(saveLogs(logs)).toBe(true);
    expect(JSON.parse(localStorage.getItem('exerciseLogs'))).toEqual(logs);
  });

  test('returns false instead of throwing when storage rejects the write', () => {
    jest.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
      throw new Error('storage blocked');
    });

    try {
      expect(saveLogs({ squat: [] })).toBe(false);
      expect(localStorage.getItem('exerciseLogs')).toBeNull();
    } finally {
      Storage.prototype.setItem.mockRestore();
    }
  });
});

describe('deleteSession stable identity', () => {
  test('deletes only the requested same-timestamp session', () => {
    const timestamp = '2026-07-28T12:00:00.000Z';
    localStorage.setItem('exerciseLogs', JSON.stringify({ bench: [
      { date: timestamp, clientSessionId: 'local-a', sets: [{ reps: 5, weight: 50 }] },
      { date: timestamp, clientSessionId: 'local-b', sets: [{ reps: 6, weight: 60 }] },
    ] }));

    const updated = deleteSession('bench', { date: timestamp, clientSessionId: 'local-a' }, null);

    expect(updated.bench).toEqual([
      expect.objectContaining({ clientSessionId: 'local-b' }),
    ]);
  });
});

describe('getSetRepFeedback', () => {
  test.each([
    [{ reps: 11, weight: 80 }, { reps: 10, weight: 80 }, 'positive', 'More reps than last time'],
    [{ reps: 9, weight: 80 }, { reps: 10, weight: 80 }, 'negative', 'Fewer reps than last time'],
    [{ reps: 10, weight: 80 }, { reps: 10, weight: 80 }, 'neutral', 'Same reps as last time'],
    [{ reps: 12, weight: 82.5 }, { reps: 10, weight: 80 }, 'neutral', 'Different weight than last time'],
    [{ reps: 12, weight: 80 }, null, 'neutral', 'No matching set last time'],
  ])('returns the expected comparison state', (current, previous, state, label) => {
    expect(getSetRepFeedback(current, previous)).toMatchObject({ state, label });
  });
});

describe('getSessionRepFeedback', () => {
  test('compares matching set numbers against the previous session', () => {
    const logs = { bench: [
      { date: '2026-07-12T09:00:00.000Z', sets: [{ reps: 10, weight: 80 }, { reps: 8, weight: 80 }] },
      { date: '2026-07-14T09:00:00.000Z', sets: [{ reps: 11, weight: 80 }, { reps: 8, weight: 82.5 }, { reps: 6, weight: 80 }] },
    ] };
    expect(getSessionRepFeedback(logs, 'bench', '2026-07-14T09:00:00.000Z')).toEqual([
      expect.objectContaining({ state: 'positive' }),
      expect.objectContaining({ reason: 'different-weight' }),
      expect.objectContaining({ reason: 'missing-match' }),
    ]);
  });
});
