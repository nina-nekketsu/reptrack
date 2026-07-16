import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Dashboard from './Dashboard';
import History from './History';

jest.mock('../components/ExerciseLogModal', () => function MockExerciseLogModal({ exercise, initialTab }) {
  return <div data-testid="exercise-history-modal">{exercise.name}:{initialTab}</div>;
});

function seedLogs() {
  const now = new Date().toISOString();
  localStorage.setItem('exercises', JSON.stringify([
    { id: 1, name: 'Bench Press', muscleGroup: 'Chest', type: 'Strength' },
  ]));
  localStorage.setItem('exerciseLogs', JSON.stringify({
    1: [{ date: now, sets: [{ reps: 5, weight: 100 }], totalReps: 5, totalVolume: 500 }],
  }));
}

describe('Today and History product surfaces', () => {
  beforeEach(() => localStorage.clear());

  test('Today renders real metrics and does not fabricate goal or streak cards', () => {
    seedLogs();
    render(<Dashboard />);

    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getAllByText('Bench Press')).not.toHaveLength(0);
    expect(screen.getAllByText('500 kg')).not.toHaveLength(0);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/today's goal/i)).not.toBeInTheDocument();
  });

  test('Today gives an honest empty state', () => {
    render(<Dashboard />);
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
    expect(screen.getByText(/first saved exercise session/i)).toBeInTheDocument();
  });

  test('History opens a real day detail and delegates edit/delete to exercise history machinery', async () => {
    seedLogs();
    render(<History />);

    await userEvent.click(screen.getByRole('button', { name: /1 exercise session/i }));
    expect(screen.getByRole('dialog', { name: /2026/i })).toBeInTheDocument();
    expect(screen.getAllByText(/1 sets/)).not.toHaveLength(0);

    await userEvent.click(screen.getByRole('button', { name: 'Edit or delete' }));
    expect(screen.getByTestId('exercise-history-modal')).toHaveTextContent('Bench Press:overview');
  });

  test('History gives an honest empty state', () => {
    render(<History />);
    expect(screen.getByText('No workout history yet')).toBeInTheDocument();
  });
});
