import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ExerciseLogModal from './ExerciseLogModal';
import { TimerProvider, useTimer } from '../context/TimerContext';

jest.mock('../lib/supabase', () => ({ supabase: null }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/CoachContext', () => ({
  useCoach: () => ({ isOnboarded: false, coachActive: false, profile: {}, metadata: {} }),
}));
jest.mock('./RecordBadges', () => () => null);
jest.mock('./VolumeGraph', () => () => null);
jest.mock('./CoachFeedback', () => () => null);
jest.mock('./RestAdvisor', () => () => null);
jest.mock('../utils/buildInfo', () => ({ formatBuildId: () => 'test' }));

function TimerState() {
  const timer = useTimer();
  return <output data-testid="rest-state">{timer.phase}:{timer.restRemainingMs}</output>;
}

function openLog(liveTrainingSheet = true) {
  return render(
    <TimerProvider>
      <TimerState />
      <ExerciseLogModal
        exercise={{ id: 'bench', name: 'Bench Press', muscleGroup: 'Chest' }}
        logs={{}}
        prescribedSets={2}
        liveTrainingSheet={liveTrainingSheet}
        onClose={jest.fn()}
      />
    </TimerProvider>
  );
}

describe('live workout rest timer on set completion', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('timerSoundEnabled', 'false');
    localStorage.setItem('timerHapticsEnabled', 'false');
    HTMLElement.prototype.scrollTo = jest.fn();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-26T12:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  test('checking a set green starts the configured rest countdown immediately in live mode', () => {
    localStorage.setItem('timerRestDefaults', JSON.stringify({ bench: 120 }));
    openLog();
    expect(screen.getByTestId('rest-state')).toHaveTextContent('idle:0');
    expect(screen.getByTestId('rest-announcement')).toBeEmptyDOMElement();

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '8' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '80' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    expect(screen.getByRole('button', { name: 'Mark set 1 not done' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('rest-state')).toHaveTextContent('resting:120000');
    expect(screen.getByTestId('rest-announcement')).toHaveTextContent('Rest started, 120 seconds');
    expect(screen.getByTestId('timer-active-phase')).toHaveTextContent('REST TIMER');

    act(() => jest.advanceTimersByTime(1000));
    expect(screen.getByTestId('rest-state')).toHaveTextContent('resting:119000');
    expect(JSON.parse(localStorage.getItem('workoutTimerState'))).toMatchObject({
      phase: 'resting',
      exerciseId: 'bench',
      restDurationMs: 120000,
      restEndAt: Date.now() + 119000,
    });
  });

  test('unchecking leaves the timer alone and checking again restarts a full rest', () => {
    openLog();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    const firstAnnouncement = screen.getByTestId('rest-announcement').firstChild;
    act(() => jest.advanceTimersByTime(10000));
    expect(screen.getByTestId('rest-state')).toHaveTextContent('resting:80000');

    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 not done' }));
    expect(screen.getByTestId('rest-state')).toHaveTextContent('resting:80000');
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    expect(screen.getByTestId('rest-state')).toHaveTextContent('resting:90000');
    expect(screen.getByTestId('rest-announcement').firstChild).not.toBe(firstAnnouncement);
  });

  test('checking a set outside live mode does not auto-start rest', () => {
    openLog(false);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    expect(screen.getByTestId('rest-state')).toHaveTextContent('idle:0');
  });

  test('a completed set during the near-end alert starts a full fresh rest', () => {
    localStorage.setItem('timerRestDefaults', JSON.stringify({ bench: 6 }));
    openLog();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    act(() => jest.advanceTimersByTime(1200));
    expect(screen.getByTestId('timer-active-phase')).toHaveClass('timer-phase--alert-feedback');

    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 not done' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    expect(screen.getByTestId('rest-state')).toHaveTextContent('resting:6000');
    expect(screen.getByTestId('timer-active-phase')).not.toHaveClass('timer-phase--alert-feedback');
    expect(screen.getByTestId('timer-active-phase')).toHaveTextContent('0:06');
  });

  test('checking another set while resting starts a fresh countdown', () => {
    openLog();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '8' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 2 reps' }), { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 1 done' }));
    act(() => jest.advanceTimersByTime(5000));
    fireEvent.click(screen.getByRole('button', { name: 'Mark set 2 done' }));
    expect(screen.getByTestId('rest-state')).toHaveTextContent('resting:90000');
    expect(screen.getByTestId('timer-active-phase')).toHaveTextContent('1:30');
    expect(screen.getByText('2/2 full sets checked')).toBeInTheDocument();
  });
});
