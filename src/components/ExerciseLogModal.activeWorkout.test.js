import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExerciseLogModal from './ExerciseLogModal';

jest.mock('./SetTimer', () => () => null);
jest.mock('./RecordBadges', () => () => null);
jest.mock('./VolumeGraph', () => () => null);
jest.mock('./CoachFeedback', () => () => null);
jest.mock('./RestAdvisor', () => () => null);
jest.mock('../utils/buildInfo', () => ({ formatBuildId: () => 'test' }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
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

  beforeEach(() => localStorage.clear());

  test('reopening an exercise enters edit mode and updates the existing session', async () => {
    const onSaved = renderModal();

    expect(await screen.findByText(/Editing session:/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+ Add Set' }));
    const inputs = screen.getAllByRole('spinbutton');
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
});
