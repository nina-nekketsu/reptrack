import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import fs from 'fs';
import path from 'path';
import SetTimer from './SetTimer';
import { useTimer } from '../context/TimerContext';

jest.mock('../context/TimerContext', () => ({
  useTimer: jest.fn(),
}));

const timerDefaults = {
  phase: 'idle',
  isIdle: true,
  isExercising: false,
  isResting: false,
  isAlert: false,
  exerciseDisplay: '0:00',
  restDisplay: '0:00',
  exerciseElapsedMs: 0,
  restRemainingMs: 0,
  restDurationMs: 90000,
  flashIdx: 0,
  setExerciseId: jest.fn(),
  setRestDuration: jest.fn(),
  startExercise: jest.fn(),
  startRest: jest.fn(),
  reset: jest.fn(),
};

function renderTimer(overrides = {}) {
  const timer = { ...timerDefaults, ...overrides };
  useTimer.mockReturnValue(timer);
  render(<SetTimer exerciseId="bench" />);
  return timer;
}

describe('SetTimer DS-11 redesign', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('shows one dominant phase with the inactive phase de-emphasized', () => {
    renderTimer({
      phase: 'resting',
      isIdle: false,
      isResting: true,
      restDisplay: '1:12',
      restRemainingMs: 72000,
      restDurationMs: 90000,
    });

    const activePhase = screen.getByTestId('timer-active-phase');
    const inactivePhase = screen.getByTestId('timer-inactive-phase');

    expect(activePhase).toHaveTextContent(/REST/);
    expect(activePhase).toHaveTextContent('1:12');
    expect(inactivePhase).toHaveTextContent(/EXERCISE/);
    expect(inactivePhase).toHaveTextContent('0:00');
    expect(activePhase).toHaveClass('timer-phase--rest');
    expect(inactivePhase).toHaveClass('timer-phase--exercise');
    expect(screen.getByText('Rest started, 90 seconds')).toHaveClass('sr-only');
    expect(screen.queryAllByText(/^Rest$/i)).toHaveLength(0);
  });

  test('defines the sr-only utility as visually hidden CSS', () => {
    const indexCss = fs.readFileSync(path.join(process.cwd(), 'src/index.css'), 'utf8');
    const srOnlyRule = indexCss.match(/\.sr-only\s*{[^}]+}/)?.[0] || '';

    expect(srOnlyRule).toContain('position: absolute');
    expect(srOnlyRule).toContain('width: 1px');
    expect(srOnlyRule).toContain('height: 1px');
    expect(srOnlyRule).toContain('overflow: hidden');
    expect(srOnlyRule).toContain('white-space: nowrap');
  });

  test('opens a rest quick-select sheet with advisor copy and updates rest in two taps', async () => {
    const view = renderTimer();

    await userEvent.click(screen.getByRole('button', { name: /choose rest duration, current 90 seconds/i }));

    const sheet = screen.getByRole('dialog', { name: /choose rest duration/i });
    expect(sheet).toHaveTextContent('Suggested 2–4 min for hard hypertrophy sets. Pick what matches this set.');

    await userEvent.click(within(sheet).getByRole('button', { name: '120s' }));

    expect(view.setRestDuration).toHaveBeenCalledWith(120000);
    expect(localStorage.getItem('timerRestDefaults')).toContain('120');
    expect(screen.queryByRole('dialog', { name: /choose rest duration/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /choose rest duration, current 120 seconds/i })).toBeInTheDocument();
  });

  test('keeps custom rest input inside expandable settings with a labeled auto-start switch', async () => {
    renderTimer();

    expect(screen.queryByLabelText('Custom rest seconds')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /rest settings/i }));

    expect(screen.getByLabelText('Custom rest seconds')).toHaveValue(90);
    expect(screen.getByRole('switch', { name: /auto-start next set after rest/i })).toHaveAttribute('aria-checked', 'false');
  });

  test('alert state uses reduced-motion-safe pulse styling instead of a flashing overlay', () => {
    renderTimer({
      phase: 'alert',
      isIdle: false,
      isResting: true,
      isAlert: true,
      restDisplay: '0:04',
      restRemainingMs: 4000,
      restDurationMs: 90000,
    });

    expect(screen.queryByTestId('timer-flash-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('timer-active-phase')).toHaveClass('timer-phase--pulse');
    expect(screen.getByText('Rest started, 90 seconds')).toHaveClass('sr-only');
  });
});
