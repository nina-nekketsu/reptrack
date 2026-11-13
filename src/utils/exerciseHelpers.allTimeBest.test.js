import { getBestAllTimeSetRecord } from './exerciseHelpers';

const query = (sessions, logicalSetNumber = 1) => getBestAllTimeSetRecord({
  logs: { row: sessions, other: [{ sets: [{ reps: 100, weight: 1000 }] }] },
  exerciseId: 'row', logicalSetNumber,
});

describe('all-time best saved primary set', () => {
  test('returns a real historical pair across rep counts, not the latest or highest-volume set', () => {
    expect(query([
      { sets: [{ reps: 12, weight: 60 }] },
      { sets: [{ reps: 5, weight: 100 }] },
      { sets: [{ reps: 9, weight: 50 }] },
    ])).toEqual({ reps: 5, weight: 100 });
  });

  test('uses most reps only at the heaviest weight, independent of history order', () => {
    const sessions = [
      { sets: [{ reps: 12, weight: 60 }] },
      { sets: [{ reps: 8, weight: 70 }] },
      { sets: [{ reps: 6, weight: 80 }] },
      { sets: [{ reps: 7, weight: 80 }] },
    ];
    expect(query(sessions)).toEqual({ reps: 7, weight: 80 });
    expect(query([...sessions].reverse())).toEqual({ reps: 7, weight: 80 });
    expect(query([...sessions, { sets: [{ reps: 8, weight: 80 }] }])).toEqual({ reps: 8, weight: 80 });
    expect(query([...sessions, { sets: [{ reps: 4, weight: 85 }] }])).toEqual({ reps: 4, weight: 85 });
    expect(query([...sessions, { sets: [{ reps: 15, weight: 70 }] }])).toEqual({ reps: 7, weight: 80 });
  });

  test('keeps set positions independent and skips warm-ups/drop children', () => {
    expect(query([{ sets: [
      { reps: 100, weight: 100, warmup: true },
      { reps: '10', weight: '60', setType: 'dropset' },
      { reps: 100, weight: 100, dropSetChild: true },
      { reps: 8, weight: 55 },
    ] }], 2)).toEqual({ reps: 8, weight: 55 });
  });

  test('ignores deleted sessions/rows, placeholders and malformed data', () => {
    const invalid = [null, {}, { reps: '', weight: 999 }, { reps: 1.5, weight: 999 },
      { reps: 10, weight: -1 }, { reps: 10, weight: '' }, { reps: 10, weight: Infinity },
      { reps: 10, weight: 999, deleted: true }, { reps: 10, weight: 999, isDeleted: true },
      { reps: 10, weight: 999, automaticPlaceholder: true }];
    expect(query([
      null, {}, { sets: {} },
      { deleted: true, sets: [{ reps: 100, weight: 100 }] },
      { isDeleted: true, sets: [{ reps: 100, weight: 100 }] },
      ...invalid.map((set) => ({ sets: [set] })),
      { sets: [{ reps: 8, weight: 55 }] },
    ])).toEqual({ reps: 8, weight: 55 });
  });

  test('uses weight first regardless of volume and handles zero-load reps', () => {
    const sessions = [{ sets: [{ reps: 10, weight: 60 }] }, { sets: [{ reps: 12, weight: 50 }] }];
    expect(query(sessions)).toEqual({ reps: 10, weight: 60 });
    expect(query([...sessions].reverse())).toEqual({ reps: 10, weight: 60 });
    expect(query([{ sets: [{ reps: 10, weight: 0 }] }, { sets: [{ reps: 12, weight: 0 }] }]))
      .toEqual({ reps: 12, weight: 0 });
  });

  test('returns null for absent history/position and does not mutate history', () => {
    expect(query([])).toBeNull();
    expect(query([{ sets: [{ reps: 8, weight: 50 }] }], 2)).toBeNull();
    expect(query([], 0)).toBeNull();
    const sessions = [{ sets: [{ reps: 8, weight: 50 }] }];
    const snapshot = JSON.stringify(sessions);
    query(sessions);
    expect(JSON.stringify(sessions)).toBe(snapshot);
  });
});
