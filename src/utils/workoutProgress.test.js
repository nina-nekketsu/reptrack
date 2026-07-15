import {
  countCompletedSets,
  countMeaningfulSets,
  getExerciseProgressState,
  isDropsetChild,
} from './workoutProgress';

describe('recovered active-workout progress semantics', () => {
  const rows = [
    { reps: '10', weight: '100', done: true },
    { reps: '8', weight: '70', done: true, setType: 'dropset_child', dropSetChild: true },
    { reps: '0', weight: '0', done: true },
    { reps: '9', weight: '100', done: false },
  ];

  test('dropset children and blank zero rows do not count as full sets', () => {
    expect(isDropsetChild(rows[1])).toBe(true);
    expect(countMeaningfulSets(rows)).toBe(2);
    expect(countCompletedSets(rows)).toBe(1);
  });

  test.each([
    [0, 3, false, 'idle'],
    [1, 3, false, 'partial'],
    [2, 3, false, 'almost'],
    [3, 3, false, 'ready'],
    [0, 3, true, 'done'],
  ])('maps %s checked of %s with explicit=%s to %s', (checked, target, explicit, state) => {
    expect(getExerciseProgressState(checked, target, explicit)).toBe(state);
  });
});
