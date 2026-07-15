const mockFrom = jest.fn();
const mockPushActiveWorkoutSession = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    from: (...args) => mockFrom(...args),
  },
}));

jest.mock('./activeWorkoutSessionSync', () => ({
  pullActiveWorkoutSession: jest.fn(),
  pushActiveWorkoutSession: (...args) => mockPushActiveWorkoutSession(...args),
}));

describe('pushAll truthful status', () => {
  let consoleErrorSpy;

  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
    localStorage.setItem('exercises', JSON.stringify([
      { id: 'exercise-1', name: 'Bench press', muscleGroup: 'Chest', type: 'Strength' },
    ]));
    localStorage.setItem('workoutPlans', JSON.stringify([
      { id: 'plan-1', name: 'Push', exercises: ['exercise-1'] },
    ]));
    mockFrom.mockImplementation((table) => ({
      upsert: jest.fn().mockResolvedValue({
        error: table === 'workout_plans' ? new Error('server rejected plans') : null,
      }),
    }));
    mockPushActiveWorkoutSession.mockResolvedValue(null);
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => consoleErrorSpy.mockRestore());

  test('a known partial bulk failure reports error and never marks successful sync', async () => {
    const { getSyncSnapshot, onSyncStatusChange, pushAll } = require('./sync');
    const statuses = [];
    const unsubscribe = onSyncStatusChange((status) => statuses.push(status));

    await pushAll('user-1');

    expect(statuses).toEqual(['syncing', 'error']);
    expect(getSyncSnapshot()).toEqual(expect.objectContaining({
      status: 'error',
      lastSuccessfulSyncAt: null,
    }));
    unsubscribe();
  });
});
