import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExerciseLogModal from './ExerciseLogModal';

let mockUser = null;
const mockPushSession = jest.fn();
const mockUpdateRemoteSession = jest.fn();

jest.mock('./SetTimer', () => () => null);
jest.mock('./RecordBadges', () => () => null);
jest.mock('./VolumeGraph', () => () => null);
jest.mock('./CoachFeedback', () => () => null);
jest.mock('./RestAdvisor', () => () => null);
jest.mock('../utils/buildInfo', () => ({ formatBuildId: () => 'test' }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: mockUser }) }));
jest.mock('../lib/sync', () => ({
  pushSession: (...args) => mockPushSession(...args),
  updateRemoteSession: (...args) => mockUpdateRemoteSession(...args),
  pushExercise: jest.fn(),
  deleteRemoteSession: jest.fn(),
  deleteRemoteExercise: jest.fn(),
}));
jest.mock('../context/CoachContext', () => ({
  useCoach: () => ({
    isOnboarded: false,
    coachActive: false,
    profile: {},
    metadata: {},
  }),
}));

const exercise = { id: 'exercise-1', name: 'Squat', muscleGroup: 'Legs' };
const activeWorkout = {
  planId: 'plan-a',
  planName: 'Plan A',
  startedAt: '2026-07-15T08:00:00.000Z',
  updatedAt: '2026-07-15T08:00:00.000Z',
  status: 'active',
  endedAt: null,
  deviceId: 'device-a',
};
const existingSession = {
  date: '2026-07-15T08:30:00.000Z',
  remoteId: 'remote-1',
  sets: [
    { reps: '10', weight: '100' },
    { reps: '9', weight: '100' },
    { reps: '8', weight: '100' },
  ],
  totalReps: 27,
  totalVolume: 2700,
};

function renderModal(onSaved = jest.fn(), onDraftProgressChange = undefined) {
  const logs = { [exercise.id]: [existingSession] };
  localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
  localStorage.setItem('exerciseLogs', JSON.stringify(logs));
  render(
    <ExerciseLogModal
      exercise={exercise}
      logs={logs}
      onSaved={onSaved}
      onDraftProgressChange={onDraftProgressChange}
      onClose={jest.fn()}
    />
  );
  return onSaved;
}

describe('active workout exercise session integrity', () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  beforeEach(() => {
    localStorage.clear();
    mockUser = null;
    mockPushSession.mockReset();
    mockUpdateRemoteSession.mockReset();
  });

  test('emits normalized draft progress for add, remove, undo, check, uncheck, and type changes', async () => {
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));
    const onDraftProgressChange = jest.fn();

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={jest.fn()}
        onClose={jest.fn()}
        prescribedSets={2}
        onDraftProgressChange={onDraftProgressChange}
      />
    );

    await waitFor(() => expect(onDraftProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      exerciseId: exercise.id,
      completedPrimarySets: 0,
      targetPrimarySets: 2,
      meaningfulPrimarySets: 0,
      isExplicitlyComplete: false,
      updatedAt: expect.any(Number),
    })));

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    await waitFor(() => expect(onDraftProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      completedPrimarySets: 1,
      targetPrimarySets: 2,
      meaningfulPrimarySets: 1,
      isExplicitlyComplete: false,
    })));
    expect(screen.getByText('1/2 full sets checked')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '+ Add Set' }));
    await waitFor(() => expect(onDraftProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      completedPrimarySets: 1,
      targetPrimarySets: 3,
      meaningfulPrimarySets: 1,
    })));
    expect(screen.getByText('1/3 full sets checked')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove set 3' }));
    await waitFor(() => expect(onDraftProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      completedPrimarySets: 1,
      targetPrimarySets: 2,
    })));
    expect(screen.getByText('1/2 full sets checked')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(onDraftProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      completedPrimarySets: 1,
      targetPrimarySets: 3,
    })));
    expect(screen.getByText('1/3 full sets checked')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: 'Set 1 type' }), { target: { value: 'warmup' } });
    await waitFor(() => expect(onDraftProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      completedPrimarySets: 0,
      targetPrimarySets: 2,
      meaningfulPrimarySets: 0,
    })));
    expect(screen.queryByText(/full sets checked/)).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole('combobox', { name: 'Set W type' }), { target: { value: 'dropset' } });
    await waitFor(() => expect(onDraftProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      completedPrimarySets: 1,
      targetPrimarySets: 3,
      meaningfulPrimarySets: 1,
    })));
    expect(screen.getByText('1/3 full sets checked')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 not done' }));
    await waitFor(() => expect(onDraftProgressChange).toHaveBeenLastCalledWith(expect.objectContaining({
      completedPrimarySets: 0,
      targetPrimarySets: 3,
      isExplicitlyComplete: false,
    })));
    expect(screen.queryByText(/full sets checked/)).not.toBeInTheDocument();
  });

  test('loads existing progress once without counting its automatic placeholder', async () => {
    const onDraftProgressChange = jest.fn();
    renderModal(jest.fn(), onDraftProgressChange);

    await waitFor(() => expect(onDraftProgressChange).toHaveBeenCalledTimes(1));
    expect(onDraftProgressChange).toHaveBeenCalledWith(expect.objectContaining({
      exerciseId: exercise.id,
      completedPrimarySets: 0,
      targetPrimarySets: 3,
      meaningfulPrimarySets: 3,
    }));
  });

  test('reopening an exercise enters edit mode and updates the existing session', async () => {
    const onSaved = renderModal();

    expect(await screen.findByText(/Editing session:/)).toBeInTheDocument();
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(8);
    expect(inputs[6]).toHaveValue(null);
    expect(inputs[7]).toHaveValue(null);
    fireEvent.change(inputs[6], { target: { value: '7' } });
    fireEvent.change(inputs[7], { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const updatedLogs = onSaved.mock.calls[0][0];
    expect(updatedLogs[exercise.id]).toHaveLength(1);
    expect(updatedLogs[exercise.id][0].remoteId).toBe('remote-1');
    expect(updatedLogs[exercise.id][0].sets).toHaveLength(4);
  });

  test('a second session requires the explicit Log as new session action', async () => {
    const onSaved = renderModal();

    expect(await screen.findByText(/Editing session:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Log as new session' }));

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const updatedLogs = onSaved.mock.calls[0][0];
    expect(updatedLogs[exercise.id]).toHaveLength(2);
    expect(updatedLogs[exercise.id][1].remoteId).toBeUndefined();
  });

  test('prefills the previous training as an unchecked template outside the active session', () => {
    const previous = {
      ...existingSession,
      date: '2026-07-14T08:30:00.000Z',
      sets: [{ reps: '10', weight: '100', done: true }],
    };
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({ [exercise.id]: [previous] }));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{ [exercise.id]: [previous] }}
        onSaved={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.queryByText(/Editing session:/)).not.toBeInTheDocument();
    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs[0]).toHaveValue(10);
    expect(inputs[1]).toHaveValue(100);
    expect(screen.getByText('Last: 10 reps · 100 kg')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mark set 1 done' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('shows the older session as the ghost while editing the current workout session', () => {
    const previous = {
      ...existingSession,
      date: '2026-07-14T08:30:00.000Z',
      sets: [{ reps: '10', weight: '100', done: true }],
    };
    const current = {
      ...existingSession,
      workoutSessionStartedAt: activeWorkout.startedAt,
      sets: [{ reps: '8', weight: '110', done: false }],
    };
    const logs = { [exercise.id]: [previous, current] };
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify(logs));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={logs}
        onSaved={jest.fn()}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByText(/Editing session:/)).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Set 1 reps' })).toHaveValue(8);
    expect(screen.getByRole('spinbutton', { name: 'Set 1 weight' })).toHaveValue(110);
    expect(screen.getByText('Last: 10 reps · 100 kg')).toBeInTheDocument();
  });

  test('appends the last meaningful set in one tap, keeps one ready row, and ignores decrement taps on that blank row', () => {
    const onSaved = jest.fn();
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={onSaved}
        onClose={jest.fn()}
      />
    );

    let inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '8' } });
    fireEvent.change(inputs[1], { target: { value: '92.5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Same as last set' }));

    inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(6);
    expect(inputs[0]).toHaveValue(8);
    expect(inputs[1]).toHaveValue(92.5);
    expect(inputs[2]).toHaveValue(8);
    expect(inputs[3]).toHaveValue(92.5);
    expect(inputs[4]).toHaveValue(null);
    expect(inputs[5]).toHaveValue(null);

    const stepperButtons = screen.getAllByTestId('set-stepper-button');
    fireEvent.click(stepperButtons[8]);
    fireEvent.click(stepperButtons[10]);
    expect(inputs[4]).toHaveValue(null);
    expect(inputs[5]).toHaveValue(null);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0][0][exercise.id][0].sets).toHaveLength(2);
  });

  test('adjusts reps and weight with steppers and Enter moves from reps to weight', () => {
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const repsInput = screen.getByRole('spinbutton', { name: 'Set 1 reps' });
    const weightInput = screen.getByRole('spinbutton', { name: 'Set 1 weight' });
    const [decreaseReps, increaseReps, , increaseWeight] = screen.getAllByTestId('set-stepper-button');
    expect(repsInput).toHaveAttribute('enterkeyhint', 'next');
    expect(screen.getAllByText('Reps')).toHaveLength(2);
    expect(screen.getAllByText('Weight (kg)')).toHaveLength(2);
    expect(increaseReps).toHaveAttribute('aria-hidden', 'true');
    expect(increaseReps).toHaveAttribute('tabindex', '-1');

    fireEvent.click(increaseReps);
    expect(repsInput).toHaveValue(1);
    fireEvent.click(decreaseReps);
    fireEvent.click(decreaseReps);
    expect(repsInput).toHaveValue(0);

    fireEvent.click(increaseWeight);
    expect(weightInput).toHaveValue(2.5);
    fireEvent.keyDown(repsInput, { key: 'Enter' });
    expect(weightInput).toHaveFocus();
  });

  test('restores a removed set from the undo toast without losing its values', () => {
    const previous = {
      ...existingSession,
      date: '2026-07-14T08:30:00.000Z',
      sets: [{ reps: '10', weight: '100', done: false }],
    };
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({ [exercise.id]: [previous] }));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{ [exercise.id]: [previous] }}
        onSaved={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Remove set 1' }));
    expect(screen.getByRole('status')).toHaveTextContent('Set removed');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    expect(screen.queryByText('Set removed')).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Set 1 reps' })).toHaveValue(10);
    expect(screen.getByRole('spinbutton', { name: 'Set 1 weight' })).toHaveValue(100);
  });

  test('restores a removed dropset parent with its children and original order', () => {
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={jest.fn()}
        onClose={jest.fn()}
      />
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '8' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '100' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Set 1 type' }), { target: { value: 'dropset' } });
    expect(screen.getByText('1↓1')).toBeInTheDocument();
    expect(screen.getByText('1↓2')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Remove set 1' }));
    expect(screen.queryByText('1↓1')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

    const inputs = screen.getAllByRole('spinbutton');
    expect(inputs).toHaveLength(8);
    expect(inputs[0]).toHaveValue(8);
    expect(inputs[1]).toHaveValue(100);
    expect(inputs[3]).toHaveValue(70);
    expect(inputs[5]).toHaveValue(49);
    expect(screen.getByText('1↓1')).toBeInTheDocument();
    expect(screen.getByText('1↓2')).toBeInTheDocument();
  });

  test('keeps undo available for four seconds and then dismisses it', () => {
    jest.useFakeTimers();
    try {
      const previous = {
        ...existingSession,
        date: '2026-07-14T08:30:00.000Z',
        sets: [{ reps: '10', weight: '100', done: false }],
      };
      localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
      localStorage.setItem('exerciseLogs', JSON.stringify({ [exercise.id]: [previous] }));

      render(
        <ExerciseLogModal
          exercise={exercise}
          logs={{ [exercise.id]: [previous] }}
          onSaved={jest.fn()}
          onClose={jest.fn()}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Remove set 1' }));
      act(() => jest.advanceTimersByTime(3999));
      expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(1));
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  test('keeps an incomplete row visible with an explicit validation message', () => {
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const repsInput = screen.getByRole('spinbutton', { name: 'Set 1 reps' });
    const weightInput = screen.getByRole('spinbutton', { name: 'Set 1 weight' });
    fireEvent.change(weightInput, { target: { value: '50' } });

    expect(screen.getByRole('alert')).toHaveTextContent('Enter reps above 0 for set 1');
    expect(repsInput).toHaveAttribute('aria-invalid', 'true');
    expect(weightInput).toHaveValue(50);

    fireEvent.change(repsInput, { target: { value: '8' } });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  test('blocks saving an explicitly invalid touched row', () => {
    const onSaved = jest.fn();
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={onSaved}
        onClose={jest.fn()}
      />
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '8' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '-1' } });
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a valid weight for set 1');

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onSaved).not.toHaveBeenCalled();
    expect(JSON.parse(localStorage.getItem('exerciseLogs'))).toEqual({});
  });

  test('persists checked sets, stable identity, and explicit exercise completion', async () => {
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));
    const onSaved = jest.fn();
    const onCompletionChange = jest.fn();

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={onSaved}
        onClose={jest.fn()}
        prescribedSets={1}
        onCompletionChange={onCompletionChange}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(onCompletionChange).toHaveBeenCalledWith(true);
    expect(onSaved.mock.calls[0][0][exercise.id][0].sets[0]).toEqual(expect.objectContaining({
      reps: '5',
      weight: '80',
      done: true,
      clientSetId: expect.any(String),
      setIndex: 0,
      setFingerprint: expect.any(String),
    }));
  });

  test('a normal close save also stores the returned remote id for a later reopen', async () => {
    mockUser = { id: 'user-1' };
    mockPushSession.mockResolvedValue('remote-closed');
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));
    const onClose = jest.fn();

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={jest.fn()}
        onClose={onClose}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('exerciseLogs'));
      expect(stored[exercise.id][0].remoteId).toBe('remote-closed');
    });
    expect(mockPushSession).toHaveBeenCalledTimes(1);
  });

  test('a delayed remote id merge preserves newer local set edits', async () => {
    mockUser = { id: 'user-1' };
    let resolveInsert;
    mockPushSession.mockReturnValue(new Promise((resolve) => {
      resolveInsert = resolve;
    }));
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={jest.fn()}
        onClose={jest.fn()}
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    const newerLogs = JSON.parse(localStorage.getItem('exerciseLogs'));
    newerLogs[exercise.id][0].sets[0].reps = '9';
    localStorage.setItem('exerciseLogs', JSON.stringify(newerLogs));

    await act(async () => resolveInsert('remote-delayed'));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('exerciseLogs'));
      expect(stored[exercise.id][0]).toMatchObject({
        remoteId: 'remote-delayed',
        sets: [expect.objectContaining({ reps: '9', weight: '80' })],
      });
    });
  });

  test('stay-open sync does not overwrite an input edited while the insert is pending', async () => {
    mockUser = { id: 'user-1' };
    let resolveInsert;
    mockPushSession.mockReturnValue(new Promise((resolve) => {
      resolveInsert = resolve;
    }));
    mockUpdateRemoteSession.mockResolvedValue(true);
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={jest.fn()}
        onClose={jest.fn()}
        stayOpenOnSave
      />
    );

    let inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '7' } });
    await act(async () => resolveInsert('remote-pending'));

    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled());
    expect(screen.getAllByRole('spinbutton')[0]).toHaveValue(7);

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(mockUpdateRemoteSession).toHaveBeenCalledTimes(1));
    expect(mockUpdateRemoteSession).toHaveBeenCalledWith(
      'remote-pending',
      exercise.id,
      expect.objectContaining({ sets: [expect.objectContaining({ reps: '7' })] }),
      'user-1'
    );
  });

  test('a failed local save tells the truth and releases the guard for one successful retry', async () => {
    mockUser = { id: 'user-1' };
    mockPushSession.mockResolvedValue(null);
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));
    const onSaved = jest.fn();
    const onCompletionChange = jest.fn();
    const originalSetItem = Storage.prototype.setItem;
    const writes = [];
    let shouldFail = true;
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(key, value) {
      if (key === 'exerciseLogs' && shouldFail) {
        shouldFail = false;
        throw new Error('storage blocked');
      }
      if (key === 'exerciseLogs') writes.push(JSON.parse(value));
      return originalSetItem.call(this, key, value);
    });

    try {
      render(
        <ExerciseLogModal
          exercise={exercise}
          logs={{}}
          onSaved={onSaved}
          onClose={jest.fn()}
          onCompletionChange={onCompletionChange}
          prescribedSets={1}
          stayOpenOnSave
        />
      );

      fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '5' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '80' } });
      fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      expect(await screen.findByText("Couldn't save on this device. Try again.")).toHaveAttribute('role', 'status');
      expect(screen.queryByText('Saved on this device')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled();
      expect(onSaved).not.toHaveBeenCalled();
      expect(onCompletionChange).not.toHaveBeenCalled();
      expect(mockPushSession).not.toHaveBeenCalled();
      expect(JSON.parse(localStorage.getItem('exerciseLogs'))).toEqual({});

      fireEvent.click(screen.getByRole('button', { name: 'Done' }));

      await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
      expect(onCompletionChange).toHaveBeenCalledTimes(1);
      expect(onCompletionChange).toHaveBeenCalledWith(true);
      expect(mockPushSession).toHaveBeenCalledTimes(1);
      expect(writes).toHaveLength(1);
      expect(writes[0][exercise.id]).toHaveLength(1);
    } finally {
      Storage.prototype.setItem.mockRestore();
    }
  });

  test('a completing save leaves ActiveWorkout handoff as the only status region', async () => {
    function CompletionHarness() {
      const [done, setDone] = React.useState(false);
      return (
        <>
          {done && (
            <p role="status" aria-live="polite">
              Exercise complete. All exercises complete.
            </p>
          )}
          <ExerciseLogModal
            exercise={exercise}
            logs={{}}
            onSaved={jest.fn()}
            onClose={jest.fn()}
            onCompletionChange={setDone}
            isExerciseDone={done}
            prescribedSets={1}
            stayOpenOnSave
          />
        </>
      );
    }

    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));
    render(<CompletionHarness />);

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await screen.findByText('Exercise complete. All exercises complete.');
    const statuses = screen.getAllByRole('status');
    expect(statuses).toHaveLength(1);
    expect(statuses[0]).toHaveTextContent('Exercise complete. All exercises complete.');
    expect(screen.getByText('Exercise complete').closest('.set-completion-summary')).not.toHaveAttribute('role');
    expect(screen.queryByText('Saved on this device')).not.toBeInTheDocument();
  });

  test('same-frame pointer and keyboard save activations persist and sync once', async () => {
    mockUser = { id: 'user-1' };
    let resolveInsert;
    mockPushSession.mockReturnValue(new Promise((resolve) => {
      resolveInsert = resolve;
    }));
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));
    const onSaved = jest.fn();

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={onSaved}
        onClose={jest.fn()}
        stayOpenOnSave
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '80' } });
    const doneButton = screen.getByRole('button', { name: 'Done' });

    act(() => {
      fireEvent.click(doneButton, { detail: 1 });
      fireEvent.click(doneButton, { detail: 0 });
    });

    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(mockPushSession).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem('exerciseLogs'))[exercise.id]).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Saving…' })).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Saving…' })).toBeDisabled();

    await act(async () => resolveInsert('remote-single'));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Done' })).toBeEnabled());
  });

  test('a pending stay-open insert can finish after unmount without losing its remote id', async () => {
    mockUser = { id: 'user-1' };
    let resolveInsert;
    mockPushSession.mockReturnValue(new Promise((resolve) => {
      resolveInsert = resolve;
    }));
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));

    const view = render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={jest.fn()}
        onClose={jest.fn()}
        stayOpenOnSave
      />
    );

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    view.unmount();

    await act(async () => resolveInsert('remote-after-close'));
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('exerciseLogs'));
      expect(stored[exercise.id][0].remoteId).toBe('remote-after-close');
    });
  });

  test('an authenticated stay-open save retains its remote id for the next edit', async () => {
    mockUser = { id: 'user-1' };
    mockPushSession.mockResolvedValue('remote-new');
    mockUpdateRemoteSession.mockResolvedValue(true);
    localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
    localStorage.setItem('exerciseLogs', JSON.stringify({}));

    render(
      <ExerciseLogModal
        exercise={exercise}
        logs={{}}
        onSaved={jest.fn()}
        onClose={jest.fn()}
        stayOpenOnSave
      />
    );

    let inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('exerciseLogs'));
      expect(stored[exercise.id][0].remoteId).toBe('remote-new');
    });

    inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(mockUpdateRemoteSession).toHaveBeenCalledTimes(1));
    expect(mockUpdateRemoteSession).toHaveBeenCalledWith(
      'remote-new',
      exercise.id,
      expect.objectContaining({ remoteId: 'remote-new' }),
      'user-1'
    );
    expect(mockPushSession).toHaveBeenCalledTimes(1);
  });
});
