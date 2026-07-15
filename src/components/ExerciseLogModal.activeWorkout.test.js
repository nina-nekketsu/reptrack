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

function renderModal(onSaved = jest.fn()) {
  const logs = { [exercise.id]: [existingSession] };
  localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
  localStorage.setItem('exerciseLogs', JSON.stringify(logs));
  render(
    <ExerciseLogModal
      exercise={exercise}
      logs={logs}
      onSaved={onSaved}
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
