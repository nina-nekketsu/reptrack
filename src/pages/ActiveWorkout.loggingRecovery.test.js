import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import ActiveWorkout from './ActiveWorkout';
import { saveActiveWorkoutSession } from '../lib/activeWorkoutSession';

const mockNavigate = jest.fn();
const mockPushActiveWorkoutSession = jest.fn();
const mockTimer = { isResting: false, restDisplay: '0:00', startRest: jest.fn(), stopAll: jest.fn() };
const mockCoach = {
  isOnboarded: false,
  profile: {},
  metadata: {},
  activateCoach: jest.fn(),
  deactivateCoach: jest.fn(),
  updateMetadata: jest.fn(),
  addCardioLog: jest.fn(),
};

jest.mock('react-router-dom', () => ({
  useParams: () => ({ planId: 'plan-a' }),
  useNavigate: () => mockNavigate,
}));
jest.mock('../context/TimerContext', () => ({ useTimer: () => mockTimer }));
jest.mock('../context/CoachContext', () => ({ useCoach: () => mockCoach }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../lib/sync', () => ({
  pushActiveWorkoutSession: (...args) => mockPushActiveWorkoutSession(...args),
}));
jest.mock('../lib/coachCloud', () => ({
  beginCoachWorkout: jest.fn(() => Promise.resolve()),
  endCoachWorkout: jest.fn(() => Promise.resolve()),
}));
jest.mock('../components/WorkoutSummary', () => () => null);
jest.mock('../components/ExerciseLogModal', () => function MockExerciseLogModal({
  exercise,
  workoutSessionEntryKey,
  isExerciseDone,
  onCompletionChange,
}) {
  return (
    <div role="dialog" aria-label={`Log ${workoutSessionEntryKey}`}>
      <span>{exercise.name}</span>
      <span>{isExerciseDone ? 'Done state' : 'Incomplete state'}</span>
      <button onClick={() => onCompletionChange(true)}>Complete entry</button>
    </div>
  );
});
jest.mock('../lib/activeWorkoutSession', () => {
  const actual = jest.requireActual('../lib/activeWorkoutSession');
  return {
    ...actual,
    saveActiveWorkoutSession: jest.fn((...args) => actual.saveActiveWorkoutSession(...args)),
  };
});

function setup({ completedExerciseIds = [], logs = {}, startedAt = '2026-10-12T08:00:00.000Z' } = {}) {
  localStorage.setItem('workoutPlans', JSON.stringify([{
    id: 'plan-a',
    name: 'Duplicate Day',
    exercises: [
      { exerciseId: 'squat', prescribedSets: 1, prescribedReps: 5 },
      { exerciseId: 'squat', prescribedSets: 3, prescribedReps: 8 },
    ],
  }]));
  localStorage.setItem('exercises', JSON.stringify([
    { id: 'squat', name: 'Squat', muscleGroup: 'Legs' },
  ]));
  localStorage.setItem('exerciseLogs', JSON.stringify(logs));
  localStorage.setItem('activeWorkoutSession', JSON.stringify({
    planId: 'plan-a',
    planName: 'Duplicate Day',
    startedAt,
    updatedAt: startedAt,
    status: 'active',
    endedAt: null,
    deviceId: 'device-a',
    completedExerciseIds,
  }));
  return render(<ActiveWorkout />);
}

function rows() {
  return Array.from(document.querySelectorAll('.aw-exercise-row'));
}

describe('ActiveWorkout logging recovery', () => {
  beforeEach(() => {
    const actual = jest.requireActual('../lib/activeWorkoutSession');
    localStorage.clear();
    mockNavigate.mockClear();
    mockPushActiveWorkoutSession.mockClear();
    saveActiveWorkoutSession.mockReset();
    saveActiveWorkoutSession.mockImplementation((...args) => actual.saveActiveWorkoutSession(...args));
  });

  test('isolates duplicate exercise entry progress, modal identity, and completion', () => {
    setup({
      completedExerciseIds: ['squat'],
      logs: {
        squat: [{
          date: '2026-10-12T08:20:00.000Z',
          workoutSessionStartedAt: '2026-10-12T08:00:00.000Z',
          workoutSessionOrderKey: 'squat:1',
          targetSetCount: 3,
          sets: [{ reps: '8', weight: '100', done: true, planned: true }],
        }],
      },
    });

    expect(rows()[0]).toHaveClass('aw-exercise-row--idle');
    expect(rows()[1]).toHaveClass('aw-exercise-row--partial');
    expect(rows()[1]).toHaveTextContent('1/3');

    fireEvent.click(rows()[1]);
    const modal = screen.getByRole('dialog', { name: 'Log squat:1' });
    expect(within(modal).getByText('Incomplete state')).toBeInTheDocument();
    fireEvent.click(within(modal).getByRole('button', { name: 'Complete entry' }));

    expect(rows()[0]).not.toHaveClass('aw-exercise-row--done');
    expect(rows()[1]).toHaveClass('aw-exercise-row--done');
    expect(JSON.parse(localStorage.getItem('activeWorkoutSession')).completedExerciseIds)
      .toEqual(['squat', 'squat:1']);
  });

  test('passes the rendered session identity to update and end commands', () => {
    setup();
    fireEvent.click(rows()[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Complete entry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Workout menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'End workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'End & Save' }));

    const update = saveActiveWorkoutSession.mock.calls.find(([command]) => command.action === 'update')[0];
    const end = saveActiveWorkoutSession.mock.calls.find(([command]) => command.action === 'end')[0];
    expect(update.expectedSession).toEqual({
      planId: 'plan-a',
      startedAt: '2026-10-12T08:00:00.000Z',
    });
    expect(end.expectedSession).toEqual(update.expectedSession);
  });

  test.each([
    ['activeWorkoutSessionChanged', false],
    ['storage', true],
  ])('closes stale UI and redirects when %s reports the rendered session ended', (eventName, storageEvent) => {
    setup();
    fireEvent.click(rows()[0]);
    expect(screen.getByRole('dialog', { name: 'Log squat:0' })).toBeInTheDocument();

    localStorage.setItem('activeWorkoutSession', JSON.stringify({
      planId: 'plan-a',
      planName: 'Duplicate Day',
      startedAt: '2026-10-12T08:00:00.000Z',
      updatedAt: '2026-10-12T09:00:00.000Z',
      status: 'ended',
      endedAt: '2026-10-12T09:00:00.000Z',
      deviceId: 'device-b',
      completedExerciseIds: [],
    }));
    act(() => {
      window.dispatchEvent(storageEvent
        ? new StorageEvent('storage', { key: 'activeWorkoutSession' })
        : new Event(eventName));
    });

    expect(screen.queryByRole('dialog', { name: 'Log squat:0' })).not.toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith('/workouts', { replace: true });
  });

  test('redirects instead of overwriting a replacement session identity', () => {
    setup();
    const saveCount = saveActiveWorkoutSession.mock.calls.length;
    localStorage.setItem('activeWorkoutSession', JSON.stringify({
      planId: 'plan-a',
      planName: 'Replacement',
      startedAt: '2026-10-12T10:00:00.000Z',
      updatedAt: '2026-10-12T10:00:00.000Z',
      status: 'active',
      endedAt: null,
      deviceId: 'device-b',
      completedExerciseIds: [],
    }));

    act(() => window.dispatchEvent(new Event('activeWorkoutSessionChanged')));

    expect(mockNavigate).toHaveBeenCalledWith('/workouts', { replace: true });
    expect(saveActiveWorkoutSession).toHaveBeenCalledTimes(saveCount);
    expect(JSON.parse(localStorage.getItem('activeWorkoutSession')).startedAt)
      .toBe('2026-10-12T10:00:00.000Z');
  });
});
