import { render, screen } from '@testing-library/react';
import fs from 'fs';
import path from 'path';
import Dashboard from './pages/Dashboard';

const SRC_ROOT = path.resolve(__dirname);

function readSrc(relativePath) {
  return fs.readFileSync(path.join(SRC_ROOT, relativePath), 'utf8');
}

describe('Gym Floor design contract', () => {
  test('declares exact graphite semantic tokens and accessible global affordances', () => {
    const css = readSrc('index.css');
    const color = (value) => `#${value}`;
    const requiredTokens = {
      '--gym-bg-0': color('0F1216'),
      '--gym-bg-1': color('161B22'),
      '--gym-bg-2': color('1E252E'),
      '--gym-bg-3': color('273039'),
      '--gym-line': color('2C3540'),
      '--gym-line-strong': color('46525F'),
      '--gym-ink-hi': color('F3EFE6'),
      '--gym-ink-mid': color('BCC3CC'),
      '--gym-ink-low': color('8D97A3'),
      '--gym-ink-on-accent': color('0F1216'),
      '--gym-go': color('3BD07F'),
      '--gym-go-dim': color('1E4634'),
      '--gym-rest': color('E3A83B'),
      '--gym-rest-dim': color('4A3A1B'),
      '--gym-danger': color('E4633F'),
      '--gym-danger-dim': color('4A281E'),
      '--gym-record': color('E8C15A'),
      '--gym-focus': color('8FD8B2'),
    };

    Object.entries(requiredTokens).forEach(([name, value]) => {
      expect(css).toContain(`${name}: ${value}`);
    });
    expect(css).toContain('--space-1: 4px');
    expect(css).toContain('--touch-target: 44px');
    expect(css).toContain('--workout-touch-target: 48px');
    expect(css).toContain('min-height: 100dvh');
    expect(css).toContain(':focus-visible');
    expect(css).toContain('2px solid var(--gym-focus)');
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
  });

  test('bottom navigation is labelled Today and uses local SVG currentColor icons', () => {
    const navSource = readSrc('components/BottomNav.js');

    expect(navSource).toContain("label: 'Today'");
    expect(navSource).toContain('aria-label="Main"');
    expect(navSource).toContain('<svg');
    expect(navSource).toContain('aria-hidden="true"');
    expect(navSource).toContain('fill="none"');
    expect(navSource).toContain('stroke="currentColor"');
    expect(navSource).not.toMatch(new RegExp(`[${[0x1F3E0, 0x1F3CB, 0x1F9E0, 0x1F4CB, 0x1F464].map((code) => String.fromCodePoint(code)).join('')}]`, 'u'));
  });

  test('Today dashboard summarizes real local exercise logs instead of placeholders', () => {
    const now = new Date('2026-07-15T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(now);
    localStorage.setItem('exerciseLogs', JSON.stringify({
      squat: [
        {
          date: '2026-07-14T09:00:00.000Z',
          totalVolume: 1200,
          totalReps: 30,
          sets: [{ reps: 10, weight: 40 }, { reps: 10, weight: 40 }, { reps: 10, weight: 40 }],
        },
      ],
      bench: [
        {
          date: '2026-07-15T10:00:00.000Z',
          totalVolume: 900,
          totalReps: 18,
          sets: [{ reps: 8, weight: 50 }, { reps: 10, weight: 50 }],
        },
      ],
    }));
    localStorage.setItem('activeWorkoutSession', JSON.stringify({
      planId: 'upper',
      planName: 'Upper Body Day',
      startedAt: '2026-07-15T11:00:00.000Z',
      status: 'active',
    }));

    render(<Dashboard />);

    expect(screen.getByRole('heading', { name: /today/i })).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('2.1t')).toBeInTheDocument();
    expect(screen.getByText(/Upper Body Day/)).toBeInTheDocument();
    expect(screen.queryByText('—')).not.toBeInTheDocument();

    jest.useRealTimers();
  });
});
