import {
  ensureSetIdentity,
  getSetFingerprint,
  normalizeSetIdentities,
} from './setIdentity';

describe('stable recovered set identity', () => {
  test('preserves an existing identity and assigns deterministic set indexes', () => {
    const rows = normalizeSetIdentities([
      { clientSetId: 'set-a', reps: '10', weight: '100' },
      { reps: '8', weight: '90' },
    ]);

    expect(rows[0]).toMatchObject({ clientSetId: 'set-a', setIndex: 0 });
    expect(rows[1].clientSetId).toEqual(expect.any(String));
    expect(rows[1].setIndex).toBe(1);
  });

  test('fingerprint binds identity, values, type, and index', () => {
    const row = ensureSetIdentity({
      clientSetId: 'set-a',
      reps: '10',
      weight: '100',
      setType: 'dropset',
      setIndex: 2,
    });
    expect(getSetFingerprint(row)).toBe('set-a|10|100|dropset|2');
  });
});
