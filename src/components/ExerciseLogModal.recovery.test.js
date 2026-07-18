import {
  applySetUpdate,
  createDropsetChildRows,
  isDropsetChild,
  normalizeSetRow,
  withTrailingEmptyRow,
} from './ExerciseLogModal';

describe('recovered set-entry behavior', () => {
  test('a dropset parent creates two rounded 70 percent child rows', () => {
    const rows = applySetUpdate([
      normalizeSetRow({ reps: '10', weight: '101' }),
    ], 0, 'setType', 'dropset');

    expect(rows).toHaveLength(3);
    expect(rows[0].setType).toBe('dropset');
    expect(rows.slice(1).map((row) => row.weight)).toEqual(['71', '50']);
    expect(rows.slice(1).every(isDropsetChild)).toBe(true);
    expect(rows.slice(1).every((row) => row.reps === '' && row.done === false)).toBe(true);
  });

  test('previous-training templates reset checks and end in one ready normal row', () => {
    const rows = withTrailingEmptyRow([
      { clientSetId: 'old-a', reps: 10, weight: 100, done: true },
      { clientSetId: 'old-b', reps: 8, weight: 90, done: true },
    ], { resetDone: true });

    expect(rows.slice(0, 2).map((row) => row.done)).toEqual([false, false]);
    expect(rows[2]).toMatchObject({ reps: '', weight: '', setType: 'normal', done: false });
    expect(rows[0].clientSetId).toBe('old-a');
  });

  test('child rows are refreshed when their dropset parent weight changes', () => {
    const rows = [
      normalizeSetRow({ reps: '10', weight: '100', setType: 'dropset' }),
      ...createDropsetChildRows('100'),
    ];
    const updated = applySetUpdate(rows, 0, 'weight', '80');
    expect(updated.slice(1).map((row) => row.weight)).toEqual(['56', '39']);
  });
});
