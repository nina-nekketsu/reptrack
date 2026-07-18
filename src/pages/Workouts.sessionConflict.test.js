import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import Workouts from './Workouts';
import { pushActiveWorkoutSession } from '../lib/sync';

const mockNavigate = jest.fn();
const mockStopAll = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}), { virtual: true });

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' } }),
}));

jest.mock('../context/TimerContext', () => ({
  useTimer: () => ({ stopAll: mockStopAll }),
}));

jest.mock('../lib/sync', () => ({
  pushPlan: jest.fn(),
  pushExercise: jest.fn(),
  pushSettings: jest.fn(),
  pushActiveWorkoutSession: jest.fn(() => Promise.resolve({ ok: true })),
}));

const activeLegs = {
  planId: 'legs-biceps-day',
  planName: 'Legs & Biceps Day',
  startedAt: '2026-07-18T08:00:00.000Z',
  updatedAt: '2026-07-18T08:00:00.000Z',
  status: 'active',
  endedAt: null,
  deviceId: 'device-a',
  completedExerciseIds: [],
};

function seedDifferentCurrentPlan() {
  localStorage.setItem('workoutPlans', JSON.stringify([
    { id: 'legs-biceps-day', name: 'Legs & Biceps Day', exercises: [] },
    { id: 'upper-body-day', name: 'Upper Body Day', exercises: [] },
  ]));
  localStorage.setItem('currentPlanId', 'upper-body-day');
  localStorage.setItem('activeWorkoutSession', JSON.stringify(activeLegs));
}

describe('Workouts cross-plan session protection', () => {
  beforeEach(() => {
    localStorage.clear();
    mockNavigate.mockReset();
    mockStopAll.mockReset();
    pushActiveWorkoutSession.mockClear();
    seedDifferentCurrentPlan();
  });

  test('starting a different plan asks instead of replacing the active session', () => {
    render(<Workouts />);

    fireEvent.click(screen.getByRole('button', { name: /start/i }));

    expect(screen.getByRole('dialog', { name: 'Workout already active' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'End & start new' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Resume existing' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('activeWorkoutSession'))).toEqual(activeLegs);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('resume existing leaves lifecycle state untouched and opens that plan', () => {
    render(<Workouts />);
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Resume existing' }));

    expect(JSON.parse(localStorage.getItem('activeWorkoutSession'))).toEqual(activeLegs);
    expect(pushActiveWorkoutSession).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/workout/legs-biceps-day');
  });

  test('end and start new writes the tombstone before the replacement session', () => {
    const writes = [];
    const originalSetItem = Storage.prototype.setItem;
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(function setItem(key, value) {
      if (key === 'activeWorkoutSession') writes.push(JSON.parse(value));
      return originalSetItem.call(this, key, value);
    });

    render(<Workouts />);
    fireEvent.click(screen.getByRole('button', { name: /start/i }));
    fireEvent.click(screen.getByRole('button', { name: 'End & start new' }));

    expect(writes.some((session) => session.planId === 'legs-biceps-day' && session.status === 'ended')).toBe(true);
    const stored = JSON.parse(localStorage.getItem('activeWorkoutSession'));
    expect(stored).toEqual(expect.objectContaining({ planId: 'upper-body-day', status: 'active' }));
    expect(pushActiveWorkoutSession).toHaveBeenCalledTimes(2);
    expect(mockStopAll).toHaveBeenCalledTimes(1);
    expect(mockNavigate).toHaveBeenCalledWith('/workout/upper-body-day');

    Storage.prototype.setItem.mockRestore();
  });
});
