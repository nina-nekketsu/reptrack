import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import ActiveWorkout from './ActiveWorkout';
import { saveActiveWorkoutSession } from '../lib/activeWorkoutSession';

const mockNavigate = jest.fn();
const mockPushActiveWorkoutSession = jest.fn();
const mockTimer = {
  isResting: false,
  restDisplay: '0:00',
  startRest: jest.fn(),
  stopAll: jest.fn(),
};
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
  isExerciseDone,
  liveTrainingSheet,
  onClose,
  onSaved,
  onCompletionChange,
  onDraftProgressChange,
}) {
  return (
    <div
      role="dialog"
      aria-label={`Log ${exercise.name}`}
      data-live-training-sheet={liveTrainingSheet ? 'true' : 'false'}
    >
      <button onClick={() => onCompletionChange(true)}>Complete {exercise.name}</button>
      <button onClick={() => onCompletionChange(false)}>Revert {exercise.name}</button>
      <button onClick={() => onDraftProgressChange({ exerciseId: exercise.id, completedPrimarySets: 1, targetPrimarySets: 3, meaningfulPrimarySets: 1, isExplicitlyComplete: false, updatedAt: 1 })}>Draft partial {exercise.name}</button>
      <button onClick={() => onDraftProgressChange({ exerciseId: exercise.id, completedPrimarySets: 2, targetPrimarySets: 2, meaningfulPrimarySets: 2, isExplicitlyComplete: true, updatedAt: 2 })}>Draft ready {exercise.name}</button>
      <button onClick={() => onDraftProgressChange({ exerciseId: exercise.id, completedPrimarySets: 1, targetPrimarySets: 2, meaningfulPrimarySets: 1, isExplicitlyComplete: false, updatedAt: 3 })}>Draft regressed {exercise.name}</button>
      <button onClick={() => onSaved({
        [exercise.id]: [{
          date: '2026-07-20T08:30:00.000Z',
          workoutSessionStartedAt: '2026-07-20T08:00:00.000Z',
          sets: [
            { reps: '5', weight: '80', done: false, planned: true },
            { reps: '5', weight: '80', done: true, planned: true },
          ],
        }],
      })}>Save draft {exercise.name}</button>
      <button onClick={onClose}>Close log</button>
      <span>{isExerciseDone ? 'Done state' : 'Incomplete state'}</span>
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

const exercises = [
  { id: 'squat', name: 'Squat', muscleGroup: 'Legs' },
  { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest' },
];

function setup({
  planExercises = [
    { exerciseId: 'squat', prescribedSets: 1, prescribedReps: 5 },
    { exerciseId: 'bench', prescribedSets: 1, prescribedReps: 5 },
  ],
  storedExercises = exercises,
  completedExerciseIds = [],
  logs = {},
} = {}) {
  localStorage.setItem('workoutPlans', JSON.stringify([{
    id: 'plan-a',
    name: 'Strength A',
    exercises: planExercises,
  }]));
  localStorage.setItem('exercises', JSON.stringify(storedExercises));
  localStorage.setItem('exerciseLogs', JSON.stringify(logs));
  localStorage.setItem('activeWorkoutSession', JSON.stringify({
    planId: 'plan-a',
    planName: 'Strength A',
    startedAt: '2026-07-20T08:00:00.000Z',
    updatedAt: '2026-07-20T08:00:00.000Z',
    status: 'active',
    endedAt: null,
    deviceId: 'device-a',
    completedExerciseIds,
  }));

  return render(<ActiveWorkout />);
}

function exerciseRow(name) {
  return screen.getByText(name).closest('.aw-exercise-row');
}

function openExercise(name) {
  fireEvent.click(exerciseRow(name));
}

function readCssRules(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return [...css.matchAll(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 'gs'))]
    .map((match) => match[1].replace(/\s+/g, ' ').trim());
}

describe('ActiveWorkout P1.5 exercise completion handoff', () => {
  beforeEach(() => {
    const actualSession = jest.requireActual('../lib/activeWorkoutSession');
    localStorage.clear();
    mockNavigate.mockClear();
    mockPushActiveWorkoutSession.mockClear();
    saveActiveWorkoutSession.mockReset();
    saveActiveWorkoutSession.mockImplementation((...args) => actualSession.saveActiveWorkoutSession(...args));
  });

  test('opens the overview Log flow as a tall live-training sheet', () => {
    setup();

    openExercise('Squat');

    expect(screen.getByRole('dialog', { name: 'Log Squat' }))
      .toHaveAttribute('data-live-training-sheet', 'true');

    const modalCss = fs.readFileSync(path.join(__dirname, 'Exercises.css'), 'utf8');
    const liveSheetRules = readCssRules(modalCss, '.modal--log.modal--live-training');
    expect(liveSheetRules).toEqual(expect.arrayContaining([
      expect.stringContaining('height: min(92dvh, 720px)'),
    ]));
  });

  test('uses only the open exercise draft for immediate badge and color transitions', () => {
    setup();
    openExercise('Squat');

    fireEvent.click(screen.getByRole('button', { name: 'Draft partial Squat' }));
    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--partial');
    expect(exerciseRow('Squat')).toHaveTextContent('1/3');
    expect(exerciseRow('Bench Press')).toHaveClass('aw-exercise-row--idle');
    expect(exerciseRow('Bench Press')).toHaveTextContent('Log');

    fireEvent.click(screen.getByRole('button', { name: 'Draft ready Squat' }));
    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--ready');
    expect(exerciseRow('Squat')).toHaveTextContent('2/2');
    expect(exerciseRow('Squat')).not.toHaveClass('aw-exercise-row--done');
  });

  test('regresses persisted completion while the draft adds work and restores it on unsaved close', () => {
    setup({ completedExerciseIds: ['squat'] });
    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--done');

    openExercise('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Draft regressed Squat' }));
    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--almost');
    expect(exerciseRow('Squat')).toHaveTextContent('1/2');
    expect(exerciseRow('Squat')).not.toHaveClass('aw-exercise-row--done');

    fireEvent.click(screen.getByRole('button', { name: 'Close log' }));
    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--done');
    expect(exerciseRow('Squat')).toHaveTextContent('Logged');
  });

  test('uses the durable target when reconstructing persisted progress', () => {
    setup({
      planExercises: [
        { exerciseId: 'squat', prescribedSets: 2, prescribedReps: 5 },
        { exerciseId: 'bench', prescribedSets: 1, prescribedReps: 5 },
      ],
      logs: {
        squat: [{
          date: '2026-07-20T08:30:00.000Z',
          workoutSessionStartedAt: '2026-07-20T08:00:00.000Z',
          targetSetCount: 4,
          sets: [{ reps: '5', weight: '80', done: true, planned: true }],
        }],
      },
    });

    expect(exerciseRow('Squat')).toHaveTextContent('1/4');
    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--partial');
  });

  test('clears the draft on save and reconstructs the saved target without double counting', () => {
    setup({ planExercises: [
      { exerciseId: 'squat', prescribedSets: 1, prescribedReps: 5 },
      { exerciseId: 'bench', prescribedSets: 1, prescribedReps: 5 },
    ] });
    openExercise('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Draft partial Squat' }));
    expect(exerciseRow('Squat')).toHaveTextContent('1/3');

    fireEvent.click(screen.getByRole('button', { name: 'Save draft Squat' }));
    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--almost');
    expect(exerciseRow('Squat')).toHaveTextContent('1/2');
    expect(exerciseRow('Squat')).not.toHaveTextContent('4/2');

    fireEvent.click(screen.getByRole('button', { name: 'Close log' }));
    openExercise('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Draft ready Squat' }));
    expect(exerciseRow('Squat')).toHaveTextContent('2/2');
    expect(exerciseRow('Bench Press')).toHaveClass('aw-exercise-row--idle');
  });

  test('persists once before announcing, preserves focus and order, and hands off past missing rows', () => {
    const actualSession = jest.requireActual('../lib/activeWorkoutSession');
    saveActiveWorkoutSession.mockImplementationOnce((command, storage) => {
      expect(screen.queryByText(/^Exercise complete\./)).not.toBeInTheDocument();
      const result = actualSession.saveActiveWorkoutSession(command, storage);
      expect(JSON.parse(localStorage.getItem('activeWorkoutSession')).completedExerciseIds).toEqual(['squat']);
      return result;
    });
    const view = setup({
      planExercises: [
        { exerciseId: 'squat', prescribedSets: 1, prescribedReps: 5 },
        { exerciseId: 'removed', prescribedSets: 1, prescribedReps: 5 },
        { exerciseId: 'bench', prescribedSets: 1, prescribedReps: 5 },
      ],
    });
    const initialRows = Array.from(view.container.querySelectorAll('.aw-exercise-row'));

    openExercise('Squat');
    const completeButton = screen.getByRole('button', { name: 'Complete Squat' });
    completeButton.focus();
    fireEvent.click(completeButton);

    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Exercise complete. Next: Bench Press');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(completeButton).toHaveFocus();
    expect(saveActiveWorkoutSession).toHaveBeenCalledTimes(1);
    expect(mockPushActiveWorkoutSession).toHaveBeenCalledTimes(1);
    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--done');
    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--ack');
    expect(exerciseRow('Bench Press')).toHaveClass('aw-exercise-row--next');
    expect(Array.from(view.container.querySelectorAll('.aw-exercise-row'))).toEqual(initialRows);

    const progress = screen.getByRole('progressbar', { name: 'Workout completion' });
    expect(progress).toHaveAttribute('aria-valuenow', '1');
    expect(progress).toHaveAttribute('aria-valuemin', '0');
    expect(progress).toHaveAttribute('aria-valuemax', '3');
    expect(progress).toHaveAttribute('aria-valuetext', '1 of 3 exercises complete');
    expect(progress.tagName.toLowerCase()).toBe('svg');
    expect(progress.querySelector('.aw-progress-bar__fill')).toHaveAttribute(
      'transform',
      'scale(0.3333333333333333 1)'
    );
    expect(progress.querySelector('.aw-progress-bar__fill')).not.toHaveAttribute('style');

    view.rerender(<ActiveWorkout />);
    fireEvent.click(screen.getByRole('button', { name: 'Complete Squat' }));
    expect(saveActiveWorkoutSession).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('status')).toBe(status);
    expect(view.container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
  });

  test('reverts final states immediately without replaying completion feedback', () => {
    const view = setup();
    openExercise('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Squat' }));
    expect(screen.getByRole('status')).toHaveTextContent('Exercise complete. Next: Bench Press');

    fireEvent.click(screen.getByRole('button', { name: 'Revert Squat' }));

    expect(JSON.parse(localStorage.getItem('activeWorkoutSession')).completedExerciseIds).toEqual([]);
    expect(saveActiveWorkoutSession).toHaveBeenCalledTimes(2);
    expect(exerciseRow('Squat')).not.toHaveClass('aw-exercise-row--done');
    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--next');
    expect(exerciseRow('Squat').querySelector('.aw-check')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'Workout completion' })).toHaveAttribute('aria-valuenow', '0');

    view.rerender(<ActiveWorkout />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(view.container.querySelector('.aw-exercise-row--ack')).not.toBeInTheDocument();
    expect(saveActiveWorkoutSession).toHaveBeenCalledTimes(2);
  });

  test('announces all complete once without turning the visible banner into a second live region', () => {
    const view = setup();
    openExercise('Squat');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Squat' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close log' }));
    openExercise('Bench Press');
    fireEvent.click(screen.getByRole('button', { name: 'Complete Bench Press' }));

    expect(screen.getByRole('status')).toHaveTextContent('Exercise complete. All exercises complete.');
    expect(view.container.querySelectorAll('[aria-live="polite"]')).toHaveLength(1);
    expect(screen.getByText('All exercises completed!').closest('.aw-complete-banner')).not.toHaveAttribute('role');
    expect(screen.getByRole('progressbar', { name: 'Workout completion' })).toHaveAttribute('aria-valuenow', '2');
    expect(saveActiveWorkoutSession).toHaveBeenCalledTimes(2);
  });

  test('does not celebrate or announce completion restored from storage', () => {
    const view = setup({ completedExerciseIds: ['squat'] });

    expect(exerciseRow('Squat')).toHaveClass('aw-exercise-row--done');
    expect(exerciseRow('Squat')).not.toHaveClass('aw-exercise-row--ack');
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(view.container.querySelectorAll('[aria-live]')).toHaveLength(0);
    expect(saveActiveWorkoutSession).not.toHaveBeenCalled();
  });

  test('a failed local end releases the busy guard and one retry succeeds', () => {
    const actualSession = jest.requireActual('../lib/activeWorkoutSession');
    saveActiveWorkoutSession
      .mockImplementationOnce((command) => {
        if (command.action === 'end') throw new Error('storage blocked');
        return actualSession.saveActiveWorkoutSession(command);
      })
      .mockImplementation((...args) => actualSession.saveActiveWorkoutSession(...args));

    setup();
    const initialPushCount = mockPushActiveWorkoutSession.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: 'Workout menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'End workout' }));
    fireEvent.click(screen.getByRole('button', { name: 'End & Save' }));

    expect(screen.getByRole('button', { name: 'End & Save' })).toBeEnabled();
    expect(mockTimer.stopAll).not.toHaveBeenCalled();
    expect(mockPushActiveWorkoutSession).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'End & Save' }));

    const endCalls = saveActiveWorkoutSession.mock.calls.filter(
      ([command]) => command?.action === 'end'
    );
    expect(endCalls).toHaveLength(2);
    expect(mockTimer.stopAll).toHaveBeenCalledTimes(1);
    expect(mockPushActiveWorkoutSession).toHaveBeenCalledTimes(initialPushCount + 1);
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/workouts', { replace: true });
  });
});

describe('P1.5 active-workout motion CSS contract', () => {
  const css = fs.readFileSync(path.join(__dirname, 'ActiveWorkout.css'), 'utf8');

  test('uses finite completion paint/check motion, an opacity-only next outline, and transform progress', () => {
    const rowRules = readCssRules(css, '.aw-exercise-row');
    const checkRules = readCssRules(css, '.aw-exercise-row--ack .aw-check');
    const nextOutlineRules = readCssRules(css, '.aw-exercise-next-outline');
    const progressFillRules = readCssRules(css, '.aw-progress-bar__fill');

    expect(rowRules.some((rule) => rule.includes('background-color 180ms var(--motion-ease-standard)'))).toBe(true);
    expect(rowRules.some((rule) => rule.includes('border-color 180ms var(--motion-ease-standard)'))).toBe(true);
    expect(checkRules.some((rule) => rule.includes('animation: aw-exercise-check-ack 180ms var(--motion-ease-enter) 1 both'))).toBe(true);
    expect(nextOutlineRules.some((rule) => rule.includes('transition: opacity 200ms var(--motion-ease-standard)'))).toBe(true);
    expect(progressFillRules.some((rule) => rule.includes('transform-origin: left center'))).toBe(true);
    expect(progressFillRules.some((rule) => rule.includes('transition: transform 220ms var(--motion-ease-standard)'))).toBe(true);
    expect(progressFillRules).not.toEqual(expect.arrayContaining([expect.stringMatching(/transition:\s*width|animation:\s*[^;]*infinite/)]));
    expect(css).toContain('@keyframes aw-exercise-check-ack');
  });

  test('keeps the progress track visible at 320px and makes reduced-motion completion states immediate', () => {
    const progressRules = readCssRules(css, '.aw-progress-bar');
    const reducedCss = css.slice(css.lastIndexOf('@media (prefers-reduced-motion: reduce)'));

    expect(progressRules.some((rule) => rule.includes('width: 100%'))).toBe(true);
    expect(progressRules.some((rule) => rule.includes('min-width: 0'))).toBe(true);
    expect(reducedCss).toMatch(/\.aw-exercise-row\s*\{[^}]*transition:\s*none;/s);
    expect(reducedCss).toMatch(/\.aw-exercise-row--ack \.aw-check\s*\{[^}]*animation:\s*none;[^}]*opacity:\s*1;[^}]*transform:\s*none;/s);
    expect(reducedCss).toMatch(/\.aw-exercise-next-outline\s*\{[^}]*transition:\s*none;/s);
    expect(reducedCss).toMatch(/\.aw-progress-bar__fill\s*\{[^}]*transition:\s*none;/s);
  });
});
