import {
  deleteSession,
  getBestExactSetRecord,
  getSetRepFeedback,
  getSessionRepFeedback,
  saveLogs,
} from './exerciseHelpers';

describe('getBestExactSetRecord', () => {
  const logs = {
    bench: [
      {
        date: '2026-07-01T08:00:00.000Z',
        clientSessionId: 'bench-a',
        sets: [
          { reps: '8', weight: '80', setType: 'warmup' },
          { reps: '8', weight: '100', setType: 'normal' },
          { reps: '8', weight: '70', setType: 'dropset_child', dropSetChild: true },
          { reps: 8, weight: 90, setType: 'normal' },
        ],
      },
      {
        date: '2026-07-02T08:00:00.000Z',
        clientSessionId: 'bench-b',
        sets: [
          { reps: 8, weight: 105, setType: 'dropset' },
          { reps: 8, weight: 120, setType: 'dropset_child', dropSetChild: true },
          { reps: 8, weight: 95, setType: 'normal' },
        ],
      },
      {
        date: '2026-07-03T08:00:00.000Z',
        clientSessionId: 'bench-invalid',
        sets: [
          { reps: 8, weight: 999, automaticPlaceholder: true },
          { reps: 8.5, weight: 999 },
          { reps: 8, weight: -1 },
        ],
      },
      {
        date: '2026-07-04T08:00:00.000Z',
        clientSessionId: 'bench-deleted',
        deleted: true,
        sets: [{ reps: 8, weight: 999 }],
      },
    ],
    squat: [{
      date: '2026-07-05T08:00:00.000Z',
      sets: [{ reps: 8, weight: 300 }],
    }],
  };

  test('returns the maximum valid weight for the exact exercise, logical set, and normalized reps', () => {
    expect(getBestExactSetRecord({
      logs,
      exerciseId: 'bench',
      logicalSetNumber: 1,
      reps: '8',
    })).toEqual({ reps: 8, weight: 105 });
    expect(getBestExactSetRecord({
      logs,
      exerciseId: 'bench',
      logicalSetNumber: 2,
      reps: 8,
    })).toEqual({ reps: 8, weight: 95 });
  });

  test('excludes different reps and set numbers instead of falling back to a near match', () => {
    expect(getBestExactSetRecord({
      logs: { bench: [{ sets: [{ reps: 6, weight: 150 }, { reps: 8, weight: 140 }] }] },
      exerciseId: 'bench',
      logicalSetNumber: 1,
      reps: 8,
    })).toBeNull();
  });

  test('excludes deleted sessions, warm-ups, dropset children, placeholders, and invalid rows', () => {
    expect(getBestExactSetRecord({
      logs: {
        bench: [
          { deleted: true, sets: [{ reps: 8, weight: 200 }] },
          { sets: [{ reps: 8, weight: 190, setType: 'warmup' }] },
          { sets: [{ reps: 8, weight: 180, dropSetChild: true }] },
          { sets: [{ reps: 8, weight: 170, automaticPlaceholder: true }] },
          { sets: [{ reps: '', weight: 160 }] },
          { sets: [{ reps: 8.5, weight: 150 }] },
          { sets: [{ reps: 8, weight: 'not-a-weight' }] },
        ],
      },
      exerciseId: 'bench',
      logicalSetNumber: 1,
      reps: 8,
    })).toBeNull();
  });

  test('excludes the current editing session by stable identity', () => {
    expect(getBestExactSetRecord({
      logs,
      exerciseId: 'bench',
      logicalSetNumber: 1,
      reps: 8,
      excludeSession: { clientSessionId: 'bench-b', date: 'different-date' },
    })).toEqual({ reps: 8, weight: 100 });
  });

  test('accepts zero weight and produces the same deterministic value for tied maxima', () => {
    const tiedLogs = { bench: [
      { date: '2026-07-01', sets: [{ reps: '10', weight: '0' }, { reps: 8, weight: 20 }] },
      { date: '2026-07-02', sets: [{ reps: 10, weight: 0 }] },
    ] };
    expect(getBestExactSetRecord({
      logs: tiedLogs,
      exerciseId: 'bench',
      logicalSetNumber: 1,
      reps: 10,
    })).toEqual({ reps: 10, weight: 0 });
  });

  test.each(['', null, undefined, 0, -1, 8.5, 'not-reps'])(
    'returns no match for invalid current reps %p',
    (reps) => {
      expect(getBestExactSetRecord({
        logs,
        exerciseId: 'bench',
        logicalSetNumber: 1,
        reps,
      })).toBeNull();
    }
  );
});

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
