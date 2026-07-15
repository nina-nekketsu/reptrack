import { getSetRepFeedback, getSessionRepFeedback } from './exerciseHelpers';

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
