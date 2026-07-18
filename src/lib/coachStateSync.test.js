import {
  COACH_STATE_STORAGE_KEYS,
  applyRemoteCoachStateRows,
  readLocalCoachState,
  toCoachStateRows,
} from './coachStateSync';

describe('coach state sync', () => {
  beforeEach(() => localStorage.clear());

  test('serializes owner-scoped coach state rows without settings data', () => {
    localStorage.setItem('coach_profile', JSON.stringify({ goal: 'strength' }));
    localStorage.setItem('coach_metadata', JSON.stringify({ restPreferences: { bench: 120 } }));
    localStorage.setItem('timerAutoStart', 'true');

    expect(toCoachStateRows('user-1', localStorage)).toEqual([
      { user_id: 'user-1', key: 'profile', state: { goal: 'strength' } },
      { user_id: 'user-1', key: 'metadata', state: { restPreferences: { bench: 120 } } },
    ]);
  });

  test('merges remote coach state by sub-key without clobbering unrelated local keys', () => {
    localStorage.setItem('coach_profile', JSON.stringify({
      goal: 'hypertrophy',
      daysPerWeek: 4,
      injuries: ['shoulder'],
    }));
    localStorage.setItem('coach_metadata', JSON.stringify({
      restPreferences: { bench: 90, squat: 150 },
      fatigueScore: 20,
    }));

    const changed = applyRemoteCoachStateRows([
      { user_id: 'user-1', key: 'profile', state: { goal: 'strength', progression: 'moderate' } },
      { user_id: 'user-1', key: 'metadata', state: { restPreferences: { bench: 120 } } },
      { user_id: 'user-2', key: 'cardio', state: { weeklyTarget: 90 } },
      { user_id: 'user-1', key: 'unknown', state: { ignored: true } },
    ], 'user-1', localStorage);

    expect(changed).toBe(true);
    expect(readLocalCoachState(localStorage)).toEqual({
      profile: {
        goal: 'strength',
        daysPerWeek: 4,
        injuries: ['shoulder'],
        progression: 'moderate',
      },
      metadata: {
        restPreferences: { bench: 120, squat: 150 },
        fatigueScore: 20,
      },
    });
    expect(localStorage.getItem(COACH_STATE_STORAGE_KEYS.cardio)).toBeNull();
  });
});
