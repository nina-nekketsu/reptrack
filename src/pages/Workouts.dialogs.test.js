import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Workouts from './Workouts';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({ useNavigate: () => mockNavigate }), { virtual: true });
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/TimerContext', () => ({ useTimer: () => ({ stopAll: jest.fn() }) }));
jest.mock('../lib/sync', () => ({
  pushPlan: jest.fn(),
  pushExercise: jest.fn(),
  pushSettings: jest.fn(),
  pushActiveWorkoutSession: jest.fn(),
}));

describe('Workouts editor dialogs', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('workoutPlans', JSON.stringify([{
      id: 'custom-plan',
      name: 'Custom Plan',
      exercises: [{ exerciseId: 'bench', prescribedSets: 3, prescribedReps: 8 }],
    }]));
    localStorage.setItem('currentPlanId', 'custom-plan');
    localStorage.setItem('exercises', JSON.stringify([
      { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest', type: 'Strength' },
    ]));
  });

  test('new-plan overlay has dialog semantics, Escape close, and focus return', () => {
    render(<Workouts />);
    const trigger = screen.getByRole('button', { name: '+ New' });

    userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'New Plan' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByPlaceholderText(/Push Day/i)).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'New Plan' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('add-exercise overlay closes with Escape and returns focus', () => {
    render(<Workouts />);
    const trigger = screen.getByRole('button', { name: /Add Exercise/ });

    userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Add Exercise' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search exercises…')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Add Exercise' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('prescription overlay closes with Escape and returns focus to its exercise row', () => {
    render(<Workouts />);
    const trigger = screen.getByRole('button', { name: /Edit Bench Press prescription/i });

    userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Bench Press' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('3')).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Bench Press' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
