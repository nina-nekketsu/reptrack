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
  useCoach: () => ({ isOnboarded: false, coachActive: false, profile: {}, metadata: {} }),
}));

const exercise = { id: 'squat', name: 'Squat', muscleGroup: 'Legs' };
const activeWorkout = {
  planId: 'plan-a',
  planName: 'Duplicate Day',
  startedAt: '2026-10-12T08:00:00.000Z',
  updatedAt: '2026-10-12T08:00:00.000Z',
  status: 'active',
  endedAt: null,
  deviceId: 'device-a',
};

function session(overrides = {}) {
  return {
    date: '2026-10-12T08:20:00.000Z',
    workoutSessionStartedAt: activeWorkout.startedAt,
    targetSetCount: 1,
    sets: [{ reps: '5', weight: '80', done: true, planned: true }],
    totalReps: 5,
    totalVolume: 400,
    ...overrides,
  };
}

function renderModal({ logs, onSaved = jest.fn(), onCompletionChange = jest.fn(), ...props }) {
  localStorage.setItem('activeWorkoutSession', JSON.stringify(activeWorkout));
  localStorage.setItem('exerciseLogs', JSON.stringify(logs));
  render(
    <ExerciseLogModal
      exercise={exercise}
      logs={logs}
      onSaved={onSaved}
      onCompletionChange={onCompletionChange}
      onClose={jest.fn()}
      stayOpenOnSave
      prescribedSets={1}
      {...props}
    />
  );
  return { onSaved, onCompletionChange };
}

describe('ExerciseLogModal logging recovery', () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  beforeEach(() => {
    localStorage.clear();
    mockUser = null;
    mockPushSession.mockReset();
    mockUpdateRemoteSession.mockReset();
  });

  test('opens and updates only the matching duplicate workout entry', async () => {
    const first = session({
      clientSessionId: 'first',
      workoutSessionOrderKey: 'squat:0',
      sets: [{ reps: '5', weight: '80', done: true, planned: true }],
    });
    const second = session({
      date: '2026-10-12T08:25:00.000Z',
      clientSessionId: 'second',
      workoutSessionOrderKey: 'squat:1',
      sets: [{ reps: '8', weight: '100', done: true, planned: true }],
    });
    const logs = { squat: [first, second] };
    const { onSaved } = renderModal({
      logs,
      workoutSessionEntryKey: 'squat:0',
      allowLegacyWorkoutSessionMatch: false,
    });

    expect(await screen.findByRole('spinbutton', { name: 'Set 1 reps' })).toHaveValue(5);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const saved = onSaved.mock.calls[0][0].squat;
    expect(saved).toHaveLength(2);
    expect(saved[0]).toMatchObject({
      clientSessionId: 'first',
      workoutSessionOrderKey: 'squat:0',
      sets: [expect.objectContaining({ reps: '6' })],
    });
    expect(saved[1]).toEqual(second);
  });

  test('does not adopt an ambiguous legacy active-workout log for a duplicate entry', () => {
    const legacy = session();
    renderModal({
      logs: { squat: [legacy] },
      workoutSessionEntryKey: 'squat:1',
      allowLegacyWorkoutSessionMatch: false,
    });

    expect(screen.queryByText(/Editing session:/)).not.toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Set 1 reps' })).toHaveValue(5);
    expect(screen.getByRole('button', { name: 'Mark set 1 done' })).toHaveAttribute('aria-pressed', 'false');
  });

  test('recalculates active-workout completion after deleting its completed log', async () => {
    const completed = session({ clientSessionId: 'completed', workoutSessionOrderKey: 'squat:0' });
    const { onCompletionChange } = renderModal({
      logs: { squat: [completed] },
      workoutSessionEntryKey: 'squat:0',
      allowLegacyWorkoutSessionMatch: false,
      initialTab: 'overview',
    });

    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(onCompletionChange).toHaveBeenCalledWith(false));
  });

  test('attaches a delayed remote id to a legacy row while preserving newer local edits', async () => {
    mockUser = { id: 'user-1' };
    let resolveInsert;
    mockPushSession.mockReturnValue(new Promise((resolve) => {
      resolveInsert = resolve;
    }));
    const legacy = session();
    renderModal({
      logs: { squat: [legacy] },
      workoutSessionEntryKey: 'squat:0',
      allowLegacyWorkoutSessionMatch: true,
    });

    expect(await screen.findByText(/Editing session:/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '6' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    const newerLogs = JSON.parse(localStorage.getItem('exerciseLogs'));
    newerLogs.squat.push({
      ...newerLogs.squat[0],
      sets: [{ ...newerLogs.squat[0].sets[0], reps: '9' }],
      note: 'typed while syncing',
    });
    localStorage.setItem('exerciseLogs', JSON.stringify(newerLogs));

    await act(async () => resolveInsert('remote-legacy'));

    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem('exerciseLogs')).squat;
      expect(stored).toHaveLength(2);
      expect(stored[0].remoteId).toBeUndefined();
      expect(stored[1]).toMatchObject({
        remoteId: 'remote-legacy',
        note: 'typed while syncing',
        sets: [expect.objectContaining({ reps: '9' })],
      });
    });
  });
});
