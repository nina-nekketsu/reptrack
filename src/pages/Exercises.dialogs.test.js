import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Exercises from './Exercises';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../components/ExerciseLogModal', () => () => null);
jest.mock('../components/ExerciseHistoryModal', () => () => null);

describe('Exercises confirmation dialog', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('exercises', JSON.stringify([
      { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest', type: 'Strength' },
    ]));
    localStorage.setItem('exerciseLogs', JSON.stringify({
      bench: [{ id: 'session-1', date: '2026-07-20T09:30:00.000Z', sets: [], totalReps: 0, totalVolume: 0 }],
    }));
  });

  test('Escape cancels deletion and returns focus to the delete trigger', () => {
    render(<Exercises />);
    const trigger = screen.getByRole('button', { name: 'Delete exercise' });

    userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Delete Bench Press?' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText(/also delete 1 logged session/i)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Delete Bench Press?' })).not.toBeInTheDocument();
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('confirming still deletes the exercise and its sessions', () => {
    render(<Exercises />);
    userEvent.click(screen.getByRole('button', { name: 'Delete exercise' }));

    userEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(screen.queryByText('Bench Press')).not.toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('exercises'))).toEqual([]);
    expect(JSON.parse(localStorage.getItem('exerciseLogs'))).toEqual({});
  });
});
