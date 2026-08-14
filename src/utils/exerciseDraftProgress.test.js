import {
  deriveExerciseDraftProgress,
  getAnchorContextIndex,
  getAnchorScrollTop,
  getAnchorSetIndex,
  isActionablePrimarySet,
} from './exerciseDraftProgress';

describe('live exercise draft progress', () => {
  const row = (overrides = {}) => ({
    clientSetId: Math.random().toString(36),
    reps: '',
    weight: '',
    setType: 'normal',
    done: false,
    ...overrides,
  });

  test('distinguishes planned primary rows from generated placeholders', () => {
    const rows = [
      row({ reps: '8', weight: '80', done: true }),
      row({ planned: true }),
      row({ automaticPlaceholder: true }),
    ];

    expect(deriveExerciseDraftProgress({ exerciseId: 'bench', rows, prescribedSets: 1 }))
      .toMatchObject({ completedPrimarySets: 1, targetPrimarySets: 2, meaningfulPrimarySets: 1 });
  });

  test('excludes warm-ups and dropset children while counting a dropset parent once', () => {
    const rows = [
      row({ reps: '12', weight: '20', done: true, setType: 'warmup' }),
      row({ reps: '8', weight: '100', done: true, setType: 'dropset' }),
      row({ reps: '8', weight: '70', done: true, setType: 'dropset_child', dropSetChild: true }),
      row({ automaticPlaceholder: true }),
    ];

    expect(deriveExerciseDraftProgress({ exerciseId: 'bench', rows, prescribedSets: 1 }))
      .toMatchObject({ completedPrimarySets: 1, targetPrimarySets: 1, meaningfulPrimarySets: 1 });
  });

  test('derives add, remove, and undo target transitions from user-planned rows', () => {
    const saved = row({ reps: '8', weight: '80', done: true });
    const added = row({ planned: true });
    const placeholder = row({ automaticPlaceholder: true });

    expect(deriveExerciseDraftProgress({ exerciseId: 'bench', rows: [saved, placeholder] }))
      .toMatchObject({ completedPrimarySets: 1, targetPrimarySets: 1 });
    expect(deriveExerciseDraftProgress({ exerciseId: 'bench', rows: [saved, added, placeholder] }))
      .toMatchObject({ completedPrimarySets: 1, targetPrimarySets: 2 });
    expect(deriveExerciseDraftProgress({ exerciseId: 'bench', rows: [placeholder], prescribedSets: 3 }))
      .toMatchObject({ completedPrimarySets: 0, targetPrimarySets: 0 });
    expect(deriveExerciseDraftProgress({ exerciseId: 'bench', rows: [saved, placeholder] }))
      .toMatchObject({ completedPrimarySets: 1, targetPrimarySets: 1 });
    expect(deriveExerciseDraftProgress({ exerciseId: 'bench', rows: [saved, added, placeholder] }))
      .toMatchObject({ completedPrimarySets: 1, targetPrimarySets: 2 });
  });

  test('selects the first incomplete primary row and tested fallbacks without reading rendered text', () => {
    const partial = [
      row({ reps: '8', weight: '80', done: true }),
      row({ reps: '8', weight: '85', done: true }),
      row({ planned: true }),
      row({ setType: 'warmup' }),
      row({ automaticPlaceholder: true }),
    ];
    expect(getAnchorSetIndex(partial)).toBe(2);
    expect(getAnchorSetIndex(partial.map((set, index) => index < 3 ? { ...set, done: true } : set))).toBe(2);
    expect(getAnchorSetIndex([row({ automaticPlaceholder: true })])).toBe(0);
    expect(getAnchorSetIndex([])).toBe(-1);
    expect(getAnchorContextIndex(partial, 2)).toBe(1);
    expect(isActionablePrimarySet(partial[3])).toBe(false);
  });

  test('keeps completed context only when the anchor still fits in the viewport', () => {
    expect(getAnchorScrollTop({
      anchorOffsetTop: 320,
      anchorHeight: 60,
      contextOffsetTop: 240,
      containerHeight: 420,
    })).toBe(232);
    expect(getAnchorScrollTop({
      anchorOffsetTop: 320,
      anchorHeight: 60,
      contextOffsetTop: 120,
      containerHeight: 180,
    })).toBe(312);
  });
});
