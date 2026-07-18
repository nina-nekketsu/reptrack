import { act, render, screen, waitFor } from '@testing-library/react';
import { TimerProvider, useTimer } from './TimerContext';

jest.mock('../lib/supabase', () => ({ supabase: null }));
jest.mock('../utils/timer', () => {
  const actual = jest.requireActual('../utils/timer');
  return {
    ...actual,
    playBeep: jest.fn(),
    vibrate: jest.fn(),
  };
});

function TimerProbe() {
  const timer = useTimer();
  return (
    <div>
      <div data-testid="phase">{timer.phase}</div>
      <div data-testid="exercise-id">{timer.exerciseId || ''}</div>
      <div data-testid="exercise-ms">{timer.exerciseElapsedMs}</div>
      <div data-testid="rest-ms">{timer.restRemainingMs}</div>
      <div data-testid="rest-duration">{timer.restDurationMs}</div>
    </div>
  );
}

function renderTimer() {
  return render(
    <TimerProvider>
      <TimerProbe />
    </TimerProvider>
  );
}

describe('TimerProvider persistence reconstruction', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('timerSoundEnabled', 'false');
    localStorage.setItem('timerHapticsEnabled', 'false');
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-18T12:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('restores exercise elapsed from timestamps after refresh', () => {
    localStorage.setItem('workoutTimerState', JSON.stringify({
      phase: 'exercising',
      exerciseId: 'bench',
      exerciseStartedAt: Date.now() - 65000,
      pausedDuration: 5000,
      exerciseElapsedFrozen: 0,
      restEndAt: null,
      restDurationMs: 90000,
    }));

    renderTimer();

    expect(screen.getByTestId('phase')).toHaveTextContent('exercising');
    expect(screen.getByTestId('exercise-id')).toHaveTextContent('bench');
    expect(screen.getByTestId('exercise-ms')).toHaveTextContent('60000');
  });

  test('restored rest transitions through alert to idle without losing exercise identity', async () => {
    localStorage.setItem('workoutTimerState', JSON.stringify({
      phase: 'resting',
      exerciseId: 'bench',
      exerciseStartedAt: null,
      pausedDuration: 0,
      exerciseElapsedFrozen: 42000,
      restEndAt: Date.now() + 3000,
      restDurationMs: 90000,
    }));

    renderTimer();

    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('alert'));

    act(() => {
      jest.advanceTimersByTime(3100);
    });

    await waitFor(() => expect(screen.getByTestId('phase')).toHaveTextContent('idle'));
    expect(screen.getByTestId('exercise-id')).toHaveTextContent('bench');
    expect(screen.getByTestId('rest-duration')).toHaveTextContent('90000');
  });

  test('completed rest restored after browser close keeps timer metadata instead of discarding it', () => {
    localStorage.setItem('workoutTimerState', JSON.stringify({
      phase: 'resting',
      exerciseId: 'bench',
      exerciseStartedAt: null,
      pausedDuration: 0,
      exerciseElapsedFrozen: 42000,
      restEndAt: Date.now() - 10000,
      restDurationMs: 120000,
    }));

    renderTimer();

    expect(screen.getByTestId('phase')).toHaveTextContent('idle');
    expect(screen.getByTestId('exercise-id')).toHaveTextContent('bench');
    expect(screen.getByTestId('rest-duration')).toHaveTextContent('120000');
  });
});
