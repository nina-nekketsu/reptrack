import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
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

function readExercisesCss() {
  return fs.readFileSync(path.join(process.cwd(), 'src/pages/Exercises.css'), 'utf8');
}

function declarationsFor(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'));
  return match?.[1].replace(/\s+/g, ' ').trim() || '';
}

function blockFor(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return '';

  const openIndex = source.indexOf('{', markerIndex + marker.length);
  let depth = 1;
  let cursor = openIndex + 1;

  while (cursor < source.length && depth > 0) {
    if (source[cursor] === '{') depth += 1;
    if (source[cursor] === '}') depth -= 1;
    cursor += 1;
  }

  return source.slice(openIndex + 1, cursor - 1);
}

function reducedMotionCss(source) {
  const marker = '@media (prefers-reduced-motion: reduce)';
  const blocks = [];
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const markerIndex = source.indexOf(marker, searchFrom);
    if (markerIndex === -1) break;

    const block = blockFor(source.slice(markerIndex), marker);
    blocks.push(block);
    searchFrom = markerIndex + marker.length + block.length + 2;
  }

  return blocks.join('\n');
}

describe('SetTimer P1.3 alert feedback', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('keeps timer state and digits authoritative while exposing one finite alert hook', () => {
    let timer = {
      ...timerDefaults,
      phase: 'alert',
      isIdle: false,
      isResting: true,
      isAlert: true,
      restDisplay: '0:04',
      restRemainingMs: 4000,
    };
    useTimer.mockImplementation(() => timer);

    const view = render(<SetTimer exerciseId="bench" />);
    const activePhase = screen.getByTestId('timer-active-phase');
    const digits = activePhase.querySelector('.timer-phase__display');

    expect(activePhase).toHaveClass('timer-phase--alert-feedback');
    expect(digits).toHaveTextContent('0:04');
    expect(digits).not.toHaveClass('timer-phase--alert-feedback');
    expect(view.container.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(view.container.querySelector('[aria-live]')).not.toHaveTextContent('0:04');
    expect(screen.queryByTestId('timer-flash-overlay')).not.toBeInTheDocument();
    expect(activePhase.querySelector('.timer-phase__alert-icon')).toHaveAttribute('aria-hidden', 'true');
    expect(activePhase.querySelector('.timer-phase__alert-text')).toHaveTextContent('Get ready');

    timer = { ...timer, restDisplay: '0:03', restRemainingMs: 3000 };
    view.rerender(<SetTimer exerciseId="bench" />);

    expect(screen.getByTestId('timer-active-phase').querySelector('.timer-phase__display')).toBe(digits);
    expect(digits).toHaveTextContent('0:03');
  });

  test('removes alert feedback directly when the authoritative phase changes', () => {
    let timer = {
      ...timerDefaults,
      phase: 'alert',
      isIdle: false,
      isResting: true,
      isAlert: true,
      restDisplay: '0:04',
      restRemainingMs: 4000,
    };
    useTimer.mockImplementation(() => timer);

    const view = render(<SetTimer exerciseId="bench" />);
    expect(view.container.querySelector('.set-timer')).toHaveClass('set-timer--alert');
    expect(screen.getByTestId('timer-active-phase')).toHaveClass('timer-phase--alert-feedback');

    timer = {
      ...timer,
      phase: 'exercising',
      isExercising: true,
      isResting: false,
      isAlert: false,
      exerciseDisplay: '0:01',
    };
    view.rerender(<SetTimer exerciseId="bench" />);

    expect(view.container.querySelector('.set-timer')).not.toHaveClass('set-timer--alert');
    expect(screen.getByTestId('timer-active-phase')).not.toHaveClass('timer-phase--alert-feedback');
    expect(view.container.querySelector('.timer-phase__alert')).not.toBeInTheDocument();
  });
});

describe('P1.3 timer feedback CSS contract', () => {
  test('uses a three-cycle 1.8 second pseudo-element ring without animating digits or box-shadow', () => {
    const css = readExercisesCss();
    const ringRule = declarationsFor(css, '.timer-phase--alert-feedback::after');
    const ringKeyframes = blockFor(css, '@keyframes timer-alert-ring');
    const activePhaseRule = declarationsFor(css, '.timer-phase--active');
    const digitsRule = declarationsFor(css, '.timer-phase__display');

    expect(ringRule).toContain('content: ""');
    expect(ringRule).toContain('animation-name: timer-alert-ring');
    expect(ringRule).toContain('animation-duration: 600ms');
    expect(ringRule).toContain('animation-iteration-count: 3');
    expect(ringRule).toContain('animation-fill-mode: both');
    expect(ringRule).not.toContain('box-shadow');
    expect(ringKeyframes).toMatch(/transform:/);
    expect(ringKeyframes).toMatch(/opacity:/);
    expect(ringKeyframes).not.toMatch(/box-shadow|background|border|width|height|margin|padding/);
    expect(activePhaseRule).toContain('background-color 170ms var(--motion-ease-standard)');
    expect(activePhaseRule).toContain('border-color 170ms var(--motion-ease-standard)');
    expect(digitsRule).not.toMatch(/animation|transition|transform/);
    expect(css).not.toMatch(/timer-rest-pulse|\.timer-phase--pulse/);
  });

  test('shows a static ring and alert content immediately under reduced motion', () => {
    const reducedCss = reducedMotionCss(readExercisesCss());
    const ringRule = declarationsFor(reducedCss, '.timer-phase--alert-feedback::after');
    const activePhaseRule = declarationsFor(reducedCss, '.timer-phase--active');
    const alertContentRule = declarationsFor(reducedCss, '.timer-phase__alert');

    expect(ringRule).toContain('animation: none');
    expect(ringRule).toContain('opacity: 1');
    expect(ringRule).toContain('transform: none');
    expect(ringRule).not.toMatch(/scale\(|translate[XY]?\(/);
    expect(activePhaseRule).toContain('transition: none');
    expect(alertContentRule).toContain('opacity: 1');
    expect(alertContentRule).toContain('transform: none');
  });
});
