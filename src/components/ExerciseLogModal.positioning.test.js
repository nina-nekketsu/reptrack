import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ExerciseLogModal from './ExerciseLogModal';

jest.mock('./SetTimer', () => () => <div>Timer</div>);
jest.mock('./RecordBadges', () => () => null);
jest.mock('./VolumeGraph', () => () => null);
jest.mock('./CoachFeedback', () => () => null);
jest.mock('./RestAdvisor', () => () => null);
jest.mock('../utils/buildInfo', () => ({ formatBuildId: () => 'test' }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/CoachContext', () => ({
  useCoach: () => ({ isOnboarded: false, coachActive: false, profile: {}, metadata: {} }),
}));

const activeWorkout = {
  planId: 'plan-a',
  startedAt: '2026-08-14T08:00:00.000Z',
  status: 'active',
};

function currentSession(sets) {
  return {
    date: '2026-08-14T08:30:00.000Z',
    workoutSessionStartedAt: activeWorkout.startedAt,
    sets,
  };
}

function renderExercise(exerciseId, sets, modalProps = {}) {
  const exercise = { id: exerciseId, name: exerciseId, muscleGroup: 'Test' };
  const logs = { [exerciseId]: [currentSession(sets)] };
  localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
  localStorage.setItem('exerciseLogs', JSON.stringify(logs));
  return render(
    <ExerciseLogModal
      exercise={exercise}
      logs={logs}
      onClose={jest.fn()}
      onSaved={jest.fn()}
      {...modalProps}
    />
  );
}

describe('ExerciseLogModal open and reopen positioning', () => {
  let animationFrames;

  beforeEach(() => {
    localStorage.clear();
    animationFrames = [];
    window.requestAnimationFrame = jest.fn((callback) => {
      animationFrames.push(callback);
      return animationFrames.length;
    });
    window.cancelAnimationFrame = jest.fn();
    window.matchMedia = jest.fn(() => ({ matches: false, addListener: jest.fn(), removeListener: jest.fn() }));
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  function flushPositioning() {
    act(() => {
      const callbacks = [...animationFrames];
      animationFrames.length = 0;
      callbacks.forEach((callback) => callback());
    });
  }

  test('positions the first incomplete primary row with one completed row of context', () => {
    renderExercise('squat', [
      { clientSetId: 'one', reps: '8', weight: '80', done: true },
      { clientSetId: 'two', reps: '8', weight: '85', done: true },
      { clientSetId: 'three', reps: '8', weight: '90', done: false },
    ]);

    const body = document.querySelector('.log-scroll-body');
    const contextRow = document.querySelector('[data-set-id="two"]');
    const anchorRow = document.querySelector('[data-set-id="three"]');
    body.getBoundingClientRect = jest.fn(() => ({ top: 100 }));
    contextRow.getBoundingClientRect = jest.fn(() => ({ top: 340 }));
    anchorRow.getBoundingClientRect = jest.fn(() => ({ top: 420 }));
    Object.defineProperty(anchorRow, 'offsetHeight', { configurable: true, value: 60 });
    Object.defineProperty(body, 'clientHeight', { configurable: true, value: 420 });

    flushPositioning();

    expect(anchorRow).toHaveAttribute('data-anchor-set', 'true');
    expect(body.scrollTo).toHaveBeenCalledWith({ top: 232, behavior: 'smooth' });
    expect(document.activeElement).toBe(document.body);
  });

  test('applies the tall outer-sheet class only when the live-training flow opts in', () => {
    const view = renderExercise('squat', [
      { clientSetId: 'one', reps: '8', weight: '80', done: false },
    ]);
    expect(document.querySelector('.modal--log')).not.toHaveClass('modal--live-training');

    view.unmount();
    renderExercise('squat', [
      { clientSetId: 'one', reps: '8', weight: '80', done: false },
    ], { liveTrainingSheet: true });
    expect(document.querySelector('.modal--log')).toHaveClass('modal--live-training');
  });

  test('uses the last completed primary row when all planned rows are done', () => {
    renderExercise('bench', [
      { clientSetId: 'one', reps: '8', weight: '80', done: true },
      { clientSetId: 'two', reps: '8', weight: '85', done: true },
    ]);

    flushPositioning();

    expect(document.querySelector('[data-set-id="two"]')).toHaveAttribute('data-anchor-set', 'true');
  });

  test('recomputes for an exercise switch and does not scroll again during manual edits', () => {
    const { rerender } = renderExercise('squat', [
      { clientSetId: 'squat-one', reps: '8', weight: '80', done: false },
    ]);
    flushPositioning();
    const firstBody = document.querySelector('.log-scroll-body');
    expect(firstBody.scrollTo).toHaveBeenCalledTimes(1);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '9' } });
    flushPositioning();
    expect(firstBody.scrollTo).toHaveBeenCalledTimes(1);

    const bench = { id: 'bench', name: 'bench', muscleGroup: 'Test' };
    const benchLogs = { bench: [currentSession([
      { clientSetId: 'bench-one', reps: '5', weight: '100', done: true },
      { clientSetId: 'bench-two', reps: '5', weight: '105', done: false },
    ])] };
    localStorage.setItem('exerciseLogs', JSON.stringify(benchLogs));
    rerender(<ExerciseLogModal exercise={bench} logs={benchLogs} onClose={jest.fn()} onSaved={jest.fn()} />);
    flushPositioning();

    expect(document.querySelector('[data-set-id="bench-two"]')).toHaveAttribute('data-anchor-set', 'true');
    expect(firstBody.scrollTo).toHaveBeenCalledTimes(2);
  });

  test('switching from a scrolled exercise to a zero-progress live exercise anchors set 1', () => {
    const { rerender } = renderExercise('squat', [
      { clientSetId: 'squat-one', reps: '8', weight: '80', done: true },
      { clientSetId: 'squat-two', reps: '8', weight: '85', done: true },
      { clientSetId: 'squat-three', reps: '8', weight: '90', done: false },
    ], { liveTrainingSheet: true, prescribedSets: 3 });
    flushPositioning();
    const body = document.querySelector('.log-scroll-body');
    body.scrollTop = 360;

    const bench = { id: 'bench', name: 'bench', muscleGroup: 'Test' };
    const benchLogs = {};
    localStorage.setItem('exerciseLogs', JSON.stringify(benchLogs));

    rerender(
      <ExerciseLogModal
        exercise={bench}
        logs={benchLogs}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        liveTrainingSheet
        prescribedSets={3}
      />
    );
    const firstBenchRow = document.querySelector('[data-set-index="0"]');
    body.getBoundingClientRect = jest.fn(() => ({ top: 200 }));
    firstBenchRow.getBoundingClientRect = jest.fn(() => ({ top: -64 }));
    flushPositioning();

    expect(firstBenchRow).toHaveAttribute('data-anchor-set', 'true');
    expect(body.scrollTop).toBe(88);
    expect(body.scrollTo).toHaveBeenLastCalledWith({ top: 88, behavior: 'smooth' });
    expect(document.activeElement).toBe(document.body);
  });

  test('positions immediately for reduced-motion users without moving focus', () => {
    window.matchMedia = jest.fn(() => ({ matches: true, addListener: jest.fn(), removeListener: jest.fn() }));
    const outside = document.createElement('button');
    document.body.appendChild(outside);
    outside.focus();

    renderExercise('row', [{ clientSetId: 'one', reps: '10', weight: '40', done: false }]);
    flushPositioning();

    const body = document.querySelector('.log-scroll-body');
    expect(body.scrollTo).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'auto' }));
    expect(document.activeElement).toBe(outside);
    outside.remove();
  });
});
