import React from 'react';
import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import BottomNav from './BottomNav';

jest.mock('react-router-dom', () => {
  const React = require('react');
  const RouterContext = React.createContext(null);

  function MemoryRouter({ initialEntries, children }) {
    const [pathname, setPathname] = React.useState(initialEntries?.[0] || '/');
    const value = React.useMemo(() => ({ pathname, setPathname }), [pathname]);
    return React.createElement(RouterContext.Provider, { value }, children);
  }

  function NavLink({ to, end, className, children, onClick, ...props }) {
    const router = React.useContext(RouterContext);
    const isActive = end
      ? router.pathname === to
      : router.pathname === to || router.pathname.startsWith(`${to}/`);

    return React.createElement('a', {
      ...props,
      href: to,
      'aria-current': isActive ? 'page' : undefined,
      className: typeof className === 'function' ? className({ isActive }) : className,
      onClick: (event) => {
        event.preventDefault();
        onClick?.(event);
        router.setPathname(to);
      },
    }, children);
  }

  return {
    MemoryRouter,
    NavLink,
    useLocation: () => React.useContext(RouterContext),
  };
});
import {
  ACTIVE_WORKOUT_KEY,
  saveActiveWorkoutSession,
} from '../lib/activeWorkoutSession';

function renderNav(initialPath = '/today') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <BottomNav />
    </MemoryRouter>
  );
}

function activeWorkout(overrides = {}) {
  return {
    planId: 'plan-a',
    planName: 'Strength A',
    startedAt: '2026-07-20T08:00:00.000Z',
    updatedAt: '2026-07-20T08:00:00.000Z',
    status: 'active',
    endedAt: null,
    deviceId: 'device-a',
    completedExerciseIds: [],
    ...overrides,
  };
}

function readBottomNavCss() {
  return fs.readFileSync(path.join(process.cwd(), 'src/components/BottomNav.css'), 'utf8');
}

function declarationsFor(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'));
  return match?.[1].replace(/\s+/g, ' ').replace(/:\s*/g, ': ').trim() || '';
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
  return blockFor(source, '@media (prefers-reduced-motion: reduce)');
}

describe('BottomNav P1.4 feedback', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('keeps aria-current authoritative and rapid navigation settled on the latest route', () => {
    const { container } = renderNav();
    const today = screen.getByRole('link', { name: 'Today' });
    const workouts = screen.getByRole('link', { name: 'Workouts' });
    const exercises = screen.getByRole('link', { name: 'Exercises' });

    expect(today).toHaveAttribute('aria-current', 'page');
    expect(today.querySelector('.nav-indicator')).toHaveAttribute('aria-hidden', 'true');

    fireEvent.click(workouts);
    fireEvent.click(exercises);

    expect(exercises).toHaveAttribute('aria-current', 'page');
    expect(workouts).not.toHaveAttribute('aria-current');
    expect(today).not.toHaveAttribute('aria-current');
    expect(container.querySelectorAll('.nav-tab.active')).toHaveLength(1);
  });

  test('renders a stored active workout as a static decorative dot on mount', () => {
    localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(activeWorkout()));
    const { container } = renderNav('/workouts');
    const workouts = screen.getByRole('link', { name: 'Workouts, workout active' });
    const dot = container.querySelector('.nav-active-dot');

    expect(workouts).toHaveAttribute('aria-current', 'page');
    expect(dot).toHaveAttribute('aria-hidden', 'true');
    expect(dot).not.toHaveClass('nav-active-dot--new');
  });

  test('cues only an inactive-to-active transition, then leaves the active dot static', () => {
    jest.useFakeTimers();
    const { container } = renderNav('/workouts');

    expect(container.querySelector('.nav-active-dot')).not.toBeInTheDocument();

    act(() => {
      saveActiveWorkoutSession({
        action: 'start',
        planId: 'plan-a',
        planName: 'Strength A',
        now: '2026-07-20T08:00:00.000Z',
        deviceId: 'device-a',
      });
    });

    expect(container.querySelector('.nav-active-dot')).toHaveClass('nav-active-dot--new');

    act(() => {
      jest.advanceTimersByTime(700);
    });

    expect(container.querySelector('.nav-active-dot')).toBeInTheDocument();
    expect(container.querySelector('.nav-active-dot')).not.toHaveClass('nav-active-dot--new');

    fireEvent.click(screen.getByRole('link', { name: 'Today' }));
    fireEvent.click(screen.getByRole('link', { name: 'Workouts, workout active' }));

    expect(container.querySelector('.nav-active-dot')).not.toHaveClass('nav-active-dot--new');
  });

  test('removes ended state immediately and allows a later newly-active cue', () => {
    jest.useFakeTimers();
    const { container } = renderNav('/workouts');

    act(() => {
      localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(activeWorkout()));
      window.dispatchEvent(new Event('activeWorkoutSessionChanged'));
    });
    expect(container.querySelector('.nav-active-dot')).toHaveClass('nav-active-dot--new');

    act(() => {
      localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(activeWorkout({
        status: 'ended',
        endedAt: '2026-07-20T09:00:00.000Z',
        updatedAt: '2026-07-20T09:00:00.000Z',
      })));
      window.dispatchEvent(new Event('activeWorkoutSessionChanged'));
    });
    expect(container.querySelector('.nav-active-dot')).not.toBeInTheDocument();

    act(() => {
      localStorage.setItem(ACTIVE_WORKOUT_KEY, JSON.stringify(activeWorkout({
        startedAt: '2026-07-20T10:00:00.000Z',
        updatedAt: '2026-07-20T10:00:00.000Z',
      })));
      window.dispatchEvent(new Event('activeWorkoutSessionChanged'));
    });
    expect(container.querySelector('.nav-active-dot')).toHaveClass('nav-active-dot--new');
  });
});

describe('P1.4 bottom-nav CSS contract', () => {
  test('uses finite selection and exactly two-cycle active-workout feedback', () => {
    const css = readBottomNavCss();
    const tabRule = declarationsFor(css, '.nav-tab');
    const indicatorRule = declarationsFor(css, '.nav-indicator');
    const selectedIndicatorRule = declarationsFor(css, '.nav-tab.active .nav-indicator');
    const selectedIconRule = declarationsFor(css, '.nav-tab.active .nav-icon');
    const activeDotRule = declarationsFor(css, '.nav-active-dot');
    const newActiveDotRule = declarationsFor(css, '.nav-active-dot--new');
    const dotKeyframes = blockFor(css, '@keyframes bottom-nav-active-cue');

    expect(tabRule).toContain('color var(--motion-duration-fast) var(--motion-ease-standard)');
    expect(indicatorRule).toContain('opacity: 0');
    expect(indicatorRule).toContain('transform: scaleX(.35)');
    expect(indicatorRule).toContain('opacity var(--motion-duration-control) var(--motion-ease-standard)');
    expect(indicatorRule).toContain('transform var(--motion-duration-control) var(--motion-ease-standard)');
    expect(selectedIndicatorRule).toContain('opacity: 1');
    expect(selectedIndicatorRule).toContain('transform: scaleX(1)');
    expect(selectedIconRule).toContain('bottom-nav-icon-settle');
    expect(activeDotRule).not.toMatch(/animation/);
    expect(newActiveDotRule).toContain('animation: bottom-nav-active-cue 350ms var(--motion-ease-standard) 2');
    expect(dotKeyframes).toMatch(/opacity:/);
    expect(dotKeyframes).toMatch(/transform:/);
    expect(dotKeyframes).not.toMatch(/width|height|margin|padding|top|left/);
    expect(css).not.toMatch(/bottom-nav[^;{}]*infinite|transition\s*:\s*all/i);
  });

  test('preserves target and label geometry at the 320px floor', () => {
    const css = readBottomNavCss();
    const tabRule = declarationsFor(css, '.nav-tab');
    const compactCss = blockFor(css, '@media(max-width:359px)');
    const compactTabRule = declarationsFor(compactCss, '.nav-tab');
    const compactLabelRule = declarationsFor(compactCss, '.nav-label');

    expect(tabRule).toContain('min-width: 64px');
    expect(tabRule).toContain('min-height: 56px');
    expect(tabRule).toContain('max-width: 112px');
    expect(compactTabRule).toContain('min-width: 0');
    expect(compactLabelRule).toContain('letter-spacing: .02em');
  });

  test('removes selection movement and pulse under reduced motion', () => {
    const reducedCss = reducedMotionCss(readBottomNavCss());
    const tabRule = declarationsFor(reducedCss, '.nav-tab');
    const indicatorRule = declarationsFor(reducedCss, '.nav-indicator');
    const selectedIndicatorRule = declarationsFor(reducedCss, '.nav-tab.active .nav-indicator');
    const selectedIconRule = declarationsFor(reducedCss, '.nav-tab.active .nav-icon');
    const dotRule = declarationsFor(reducedCss, '.nav-active-dot');
    const newDotRule = declarationsFor(reducedCss, '.nav-active-dot--new');

    expect(tabRule).toContain('transition: none');
    expect(indicatorRule).toContain('transition: none');
    expect(indicatorRule).toContain('transform: none');
    expect(selectedIndicatorRule).toContain('opacity: 1');
    expect(selectedIndicatorRule).toContain('transform: none');
    expect(selectedIconRule).toContain('animation: none');
    expect(selectedIconRule).toContain('transform: none');
    expect(dotRule).toContain('animation: none');
    expect(dotRule).toContain('opacity: 1');
    expect(dotRule).toContain('transform: none');
    expect(newDotRule).toContain('animation: none');
    expect(reducedCss).not.toMatch(/scale\(|translate[XY]?\(/);
  });
});
