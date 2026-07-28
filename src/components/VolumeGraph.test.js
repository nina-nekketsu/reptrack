import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, within } from '@testing-library/react';
import VolumeGraph from './VolumeGraph';
import ProgressGraphBlock from './ProgressGraphBlock';

const NOW = new Date('2026-07-28T12:00:00.000Z');

function session(overrides = {}) {
  return {
    id: overrides.id || overrides.remoteId || overrides.clientSessionId || overrides.date,
    date: overrides.date,
    totalVolume: overrides.totalVolume,
    sets: overrides.sets || [{ weight: 50, reps: 5 }],
    ...overrides,
  };
}

const baseSessions = [
  session({
    id: 'old',
    date: '2026-05-01T08:00:00.000Z',
    sets: [
      { setType: 'warmup', weight: 20, reps: 10 },
      { setType: 'work', weight: 60, reps: 5 },
      { setType: 'drop', weight: 40, reps: 8 },
    ],
  }),
  session({ id: 'new', date: '2026-07-20T09:30:00.000Z', sets: [{ weight: 70, reps: 5 }] }),
];

function readExercisesCss() {
  return fs.readFileSync(path.join(process.cwd(), 'src/pages/Exercises.css'), 'utf8');
}

function declarationsFor(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'));
  return match?.[1].replace(/\s+/g, ' ').replace(/:\s*/g, ': ').trim() || '';
}

describe('Exercise Progress Graph V1 ready state', () => {
  test('defaults to Volume and 3 Months, calculates logged-set volume, and renders no legend or animations', () => {
    render(<VolumeGraph sessions={baseSessions} now={NOW} />);

    expect(screen.getByRole('button', { name: 'Volume' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3 Months' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('kg total')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Exercise progress graph: Volume/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/May 1.*Volume 820 kg total/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Jul 20.*Volume 350 kg total/i)).toBeInTheDocument();
    expect(screen.queryByText(/legend/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Estimated 1RM|Export|Share/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('volume-graph-plot')).toHaveAttribute('data-animated', 'false');
  });

  test('switches to Max Weight as the only visible metric and keeps the selected range', () => {
    render(<VolumeGraph sessions={baseSessions} now={NOW} />);

    fireEvent.click(screen.getByRole('button', { name: 'Max Weight' }));

    expect(screen.getByRole('button', { name: 'Max Weight' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3 Months' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('kg')).toBeInTheDocument();
    expect(screen.queryByText('kg total')).not.toBeInTheDocument();
    expect(screen.getByLabelText(/May 1.*Max Weight 60 kg/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Jul 20.*Max Weight 70 kg/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('volume-graph-line')).toHaveLength(1);
  });

  test('filters by rolling ranges, includes All without an 8/12-session cap, and retains the selected metric', () => {
    const sessions = Array.from({ length: 13 }, (_, index) => session({
      id: `s-${index}`,
      date: new Date(Date.UTC(2025, index, 10, 8)).toISOString(),
      sets: [{ weight: 40 + index, reps: 5 }],
    }));
    render(<VolumeGraph sessions={sessions} now={NOW} />);

    fireEvent.click(screen.getByRole('button', { name: 'Max Weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.getByRole('button', { name: 'Max Weight' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByTestId('volume-graph-point-control')).toHaveLength(13);
  });

  test('spaces points by workout timestamp and orders identical timestamps by stable session id', () => {
    render(<VolumeGraph sessions={[
      session({ id: 'b', date: '2026-01-01T08:00:00.000Z', sets: [{ weight: 40, reps: 5 }] }),
      session({ id: 'a', date: '2026-01-01T08:00:00.000Z', sets: [{ weight: 45, reps: 5 }] }),
      session({ id: 'late', date: '2026-07-01T08:00:00.000Z', sets: [{ weight: 50, reps: 5 }] }),
    ]} now={NOW} />);

    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    const targets = screen.getAllByTestId('volume-graph-point-control');
    expect(targets.map((target) => target.getAttribute('data-session-id'))).toEqual(['a', 'b', 'late']);
    expect(Number(targets[0].style.left.replace('%', ''))).toBeLessThan(Number(targets[2].style.left.replace('%', '')));
  });

  test('uses unique deterministic legacy ids for persisted sessions with identical timestamps', () => {
    render(<VolumeGraph sessions={[
      { date: '2026-07-01T08:00:00.000Z', totalReps: 5, totalVolume: 200, sets: [{ weight: 40, reps: 5 }] },
      { date: '2026-07-01T08:00:00.000Z', totalReps: 6, totalVolume: 270, sets: [{ weight: 45, reps: 6 }] },
      { date: '2026-07-02T08:00:00.000Z', totalReps: 7, totalVolume: 350, sets: [{ weight: 50, reps: 7 }] },
    ]} now={NOW} />);

    const targets = screen.getAllByTestId('volume-graph-point-control');
    expect(new Set(targets.map((target) => target.getAttribute('data-session-id'))).size).toBe(3);
    fireEvent.click(targets[0]);
    expect(screen.getByRole('status', { name: 'Selected session' })).toHaveTextContent('200 kg total');
    fireEvent.click(targets[1]);
    expect(screen.getByRole('status', { name: 'Selected session' })).toHaveTextContent('270 kg total');
  });
});

describe('Exercise Progress Graph V1 states and interaction', () => {
  test('uses state precedence: loading, then offline, then error before insufficient history or ready data', () => {
    const { rerender } = render(<VolumeGraph sessions={baseSessions} loading offline error="boom" now={NOW} />);
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i);
    expect(screen.queryByText('Data unavailable')).not.toBeInTheDocument();

    rerender(<VolumeGraph sessions={baseSessions} offline error="boom" now={NOW} />);
    expect(screen.getByText('Data unavailable')).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Exercise progress graph/i })).not.toBeInTheDocument();

    rerender(<VolumeGraph sessions={[]} error="boom" now={NOW} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Unable to load progress graph.');
    expect(screen.queryByText('Your progress graph will appear after your second logged workout.')).not.toBeInTheDocument();
  });

  test('shows the approved faint-frame insufficient-history copy for zero or one all-time sessions', () => {
    const { rerender } = render(<VolumeGraph sessions={[]} now={NOW} />);
    expect(screen.getByText('Your progress graph will appear after your second logged workout.')).toBeInTheDocument();
    expect(screen.getByTestId('volume-graph-empty-frame')).toBeInTheDocument();
    expect(screen.queryByTestId('volume-graph-point-control')).not.toBeInTheDocument();
    expect(screen.queryByTestId('volume-graph-line')).not.toBeInTheDocument();

    rerender(<VolumeGraph sessions={[baseSessions[0]]} now={NOW} />);
    expect(screen.getByText('Your progress graph will appear after your second logged workout.')).toBeInTheDocument();
    expect(screen.queryByTestId('volume-graph-point-control')).not.toBeInTheDocument();
  });

  test('uses zero/one in-filter defaults after all-time history qualifies', () => {
    render(<VolumeGraph sessions={[
      session({ id: 'very-old-1', date: '2025-01-01T08:00:00.000Z' }),
      session({ id: 'very-old-2', date: '2025-02-01T08:00:00.000Z' }),
    ]} now={NOW} />);

    expect(screen.getByText('No workouts in this range.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.getAllByTestId('volume-graph-point-control')).toHaveLength(2);

    fireEvent.click(screen.getByRole('button', { name: '1 Month' }));
    expect(screen.getByText('No workouts in this range.')).toBeInTheDocument();
  });

  test('selects tappable 44px CSS point controls with selected-metric callouts and dismisses on outside tap', () => {
    render(<VolumeGraph sessions={baseSessions} now={NOW} />);
    const targets = screen.getAllByTestId('volume-graph-point-control');

    expect(targets[0]).toHaveClass('volume-graph__point-control');
    fireEvent.click(targets[0]);
    expect(screen.getByRole('status', { name: 'Selected session' })).toHaveTextContent(/May 1.*820 kg total/);
    expect(screen.queryByText(/1RM|reps/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Max Weight' }));
    fireEvent.click(screen.getAllByTestId('volume-graph-point-control')[1]);
    expect(screen.getByRole('status', { name: 'Selected session' })).toHaveTextContent(/Jul 20.*70 kg/);

    const interactionLayer = screen.getByTestId('volume-graph-interaction-layer');
    interactionLayer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 150, right: 320, bottom: 150, x: 0, y: 0, toJSON: () => {} });
    fireEvent.touchStart(interactionLayer, { changedTouches: [{ clientX: 319, clientY: 149 }] });
    expect(screen.queryByRole('status', { name: 'Selected session' })).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByTestId('volume-graph-point-control')[0]);
    fireEvent.pointerDown(screen.getByText('kg'));
    expect(screen.queryByRole('status', { name: 'Selected session' })).not.toBeInTheDocument();
  });

  test('routes surface pointer coordinates to the nearest point instead of SVG paint order', () => {
    render(<VolumeGraph sessions={[
      session({ id: 'near-low', date: '2026-07-01T08:00:00.000Z', sets: [{ weight: 40, reps: 5 }] }),
      session({ id: 'near-high', date: '2026-07-01T08:00:00.000Z', sets: [{ weight: 80, reps: 5 }] }),
      session({ id: 'future-anchor', date: '2026-07-02T08:00:00.000Z', sets: [{ weight: 90, reps: 5 }] }),
    ]} now={NOW} />);
    const layer = screen.getByTestId('volume-graph-interaction-layer');
    layer.getBoundingClientRect = () => ({ left: 0, top: 0, width: 320, height: 150, right: 320, bottom: 150, x: 0, y: 0, toJSON: () => {} });

    fireEvent.touchStart(layer, { changedTouches: [{ clientX: 49, clientY: 105 }] });
    expect(screen.getByRole('status', { name: 'Selected session' })).toHaveTextContent('200 kg total');

    fireEvent.touchStart(layer, { changedTouches: [{ clientX: 49, clientY: 60 }] });
    expect(screen.getByRole('status', { name: 'Selected session' })).toHaveTextContent('400 kg total');
  });

  test('rerenders immediately when sessions or active exercise change and resets derived state', () => {
    const { rerender } = render(<VolumeGraph sessions={baseSessions} exerciseId="bench" now={NOW} />);
    fireEvent.click(screen.getByRole('button', { name: 'Max Weight' }));
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    fireEvent.click(screen.getAllByTestId('volume-graph-point-control')[0]);

    rerender(<VolumeGraph sessions={[baseSessions[0], session({ id: 'edited', date: '2026-07-21T09:30:00.000Z', sets: [{ weight: 80, reps: 6 }] })]} exerciseId="bench" now={NOW} />);
    expect(screen.getByLabelText(/Max Weight 80 kg/i)).toBeInTheDocument();

    rerender(<VolumeGraph sessions={[session({ id: 'squat-1', date: '2026-07-01T08:00:00.000Z' }), session({ id: 'squat-2', date: '2026-07-10T08:00:00.000Z' })]} exerciseId="squat" now={NOW} />);
    expect(screen.getByRole('button', { name: 'Volume' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '3 Months' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByRole('status', { name: 'Selected session' })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Max Weight 80 kg/i)).not.toBeInTheDocument();
  });
});

describe('Exercise Progress Graph V1 date windows', () => {
  test('uses local calendar boundaries rather than UTC boundaries', () => {
    const now = new Date(2026, 2, 31, 0, 30, 0, 0);
    const localBoundary = new Date(2026, 1, 28, 0, 30, 0, 0);
    const beforeLocalBoundary = new Date(localBoundary.getTime() - 1);
    render(<VolumeGraph sessions={[
      session({ id: 'local-boundary', date: localBoundary.toISOString(), sets: [{ weight: 40, reps: 5 }] }),
      session({ id: 'before-local-boundary', date: beforeLocalBoundary.toISOString(), sets: [{ weight: 45, reps: 5 }] }),
      session({ id: 'now', date: now.toISOString(), sets: [{ weight: 50, reps: 5 }] }),
    ]} now={now} />);
    fireEvent.click(screen.getByRole('button', { name: '1 Month' }));
    expect(screen.getByLabelText(/Volume 200 kg total/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Volume 225 kg total/i)).not.toBeInTheDocument();
  });

  test('subtracts calendar months with month-end clamping and inclusive lower bounds', () => {
    const now = new Date(2026, 2, 31, 12, 0, 0, 0);
    const boundary = new Date(2026, 1, 28, 12, 0, 0, 0);
    render(<VolumeGraph sessions={[
      session({ id: 'included-feb-end', date: boundary.toISOString(), sets: [{ weight: 40, reps: 5 }] }),
      session({ id: 'excluded-before-boundary', date: new Date(boundary.getTime() - 1).toISOString(), sets: [{ weight: 45, reps: 5 }] }),
      session({ id: 'now', date: now.toISOString(), sets: [{ weight: 50, reps: 5 }] }),
    ]} now={now} />);
    fireEvent.click(screen.getByRole('button', { name: '1 Month' }));
    expect(screen.getByLabelText(/Volume 200 kg total/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Volume 225 kg total/i)).not.toBeInTheDocument();
  });

  test('subtracts calendar years by preserving February 28 and excludes future sessions from All', () => {
    render(<VolumeGraph sessions={[
      session({ id: 'included-year-boundary', date: '2024-02-28T12:00:00.000Z', sets: [{ weight: 40, reps: 5 }] }),
      session({ id: 'excluded-before-year-boundary', date: '2024-02-28T11:59:59.999Z', sets: [{ weight: 45, reps: 5 }] }),
      session({ id: 'now', date: '2025-02-28T12:00:00.000Z', sets: [{ weight: 50, reps: 5 }] }),
      session({ id: 'future', date: '2025-03-01T12:00:00.000Z', sets: [{ weight: 99, reps: 5 }] }),
    ]} now={new Date('2025-02-28T12:00:00.000Z')} />);
    fireEvent.click(screen.getByRole('button', { name: '1 Year' }));
    expect(screen.getByLabelText(/Volume 200 kg total/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Volume 225 kg total/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'All' }));
    expect(screen.queryByLabelText(/Volume 495 kg total/i)).not.toBeInTheDocument();
  });

  test('clamps a leap-day one-year boundary to February 28 in a non-leap target year', () => {
    render(<VolumeGraph sessions={[
      session({ id: 'included-clamped-boundary', date: '2023-02-28T12:00:00.000Z', sets: [{ weight: 40, reps: 5 }] }),
      session({ id: 'excluded-before-clamped-boundary', date: '2023-02-28T11:59:59.999Z', sets: [{ weight: 45, reps: 5 }] }),
      session({ id: 'now', date: '2024-02-29T12:00:00.000Z', sets: [{ weight: 50, reps: 5 }] }),
    ]} now={new Date('2024-02-29T12:00:00.000Z')} />);
    fireEvent.click(screen.getByRole('button', { name: '1 Year' }));
    expect(screen.getByLabelText(/Volume 200 kg total/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Volume 225 kg total/i)).not.toBeInTheDocument();
  });
});

describe('ProgressGraphBlock V1 placement', () => {
  test('keeps Volume Over Time available for zero-session exercises', () => {
    render(<ProgressGraphBlock logs={{}} exerciseId="bench" />);

    expect(screen.getByRole('button', { name: /Show progress graph/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Show progress graph/i }));
    expect(screen.getByText('Your progress graph will appear after your second logged workout.')).toBeInTheDocument();
  });

  test('isolates exercise histories by exercise id', () => {
    render(<ProgressGraphBlock logs={{
      bench: baseSessions,
      squat: [session({ id: 'squat-1', date: '2026-07-01T08:00:00.000Z', sets: [{ weight: 100, reps: 5 }] }), session({ id: 'squat-2', date: '2026-07-15T08:00:00.000Z', sets: [{ weight: 110, reps: 5 }] })],
    }} exerciseId="squat" />);

    fireEvent.click(screen.getByRole('button', { name: /Show progress graph/i }));
    const graph = screen.getByRole('img', { name: /Exercise progress graph/i });
    expect(within(graph).queryByText(/820/)).not.toBeInTheDocument();
    expect(screen.getByLabelText(/Volume 500 kg total/i)).toBeInTheDocument();
  });
});

describe('Exercise Progress Graph V1 accessibility and sizing contracts', () => {
  test('keeps interactive point controls outside the chart image role', () => {
    render(<VolumeGraph sessions={baseSessions} now={NOW} />);
    const chartImage = screen.getByRole('img', { name: /Exercise progress graph/i });
    expect(within(chartImage).queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('volume-graph-point-control')).toHaveLength(2);
  });

  test('declares real CSS-pixel targets, 44px controls, and legible responsive axis text', () => {
    const css = readExercisesCss();
    expect(declarationsFor(css, '.volume-graph__point-control')).toMatch(/min-width:\s*44px/);
    expect(declarationsFor(css, '.volume-graph__point-control')).toMatch(/min-height:\s*44px/);
    expect(declarationsFor(css, '.volume-graph__point-control')).toMatch(/pointer-events:\s*auto/);
    expect(declarationsFor(css, '.volume-graph__control')).toMatch(/min-height:\s*44px/);
    expect(declarationsFor(css, '.volume-graph__axis-label')).toMatch(/font-size:\s*14px/);
    expect(css).toMatch(/@media\s*\(max-width:\s*380px\)[\s\S]*\.volume-graph__axis-label/);
  });
});

describe('Exercise Progress Graph V1 CSS motion contract', () => {
  test('does not animate the graph plot, line, area, or points', () => {
    const css = readExercisesCss();
    ['.volume-graph__plot', '.volume-graph__line', '.volume-graph__area', '.volume-graph__point', '.volume-graph__point-control'].forEach((selector) => {
      expect(declarationsFor(css, selector)).not.toMatch(/animation|transition/);
    });
    expect(css).not.toMatch(/@keyframes\s+volume-graph/i);
  });
});
