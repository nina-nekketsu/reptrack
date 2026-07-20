import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import VolumeGraph from './VolumeGraph';

const initialSessions = [
  { date: '2026-07-01T08:00:00.000Z', totalVolume: 1200 },
  { date: '2026-07-08T08:00:00.000Z', totalVolume: 1500 },
];

function readExercisesCss() {
  return fs.readFileSync(path.join(process.cwd(), 'src/pages/Exercises.css'), 'utf8');
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
  const marker = '@media (prefers-reduced-motion: reduce)';
  const blocks = [];
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const markerIndex = source.indexOf(marker, searchFrom);
    if (markerIndex === -1) break;

    const sourceFromMarker = source.slice(markerIndex);
    const block = blockFor(sourceFromMarker, marker);
    blocks.push(block);
    searchFrom = markerIndex + marker.length + block.length + 2;
  }

  return blocks.join('\n');
}

describe('VolumeGraph P2.4 reveal behavior', () => {
  test('keeps plotted data immediate and reuses the plot for equivalent rerenders and interaction', () => {
    const view = render(<VolumeGraph sessions={initialSessions} />);
    const graph = screen.getByRole('img', { name: /volume over time/i });
    const initialPlot = screen.getByTestId('volume-graph-plot');

    expect(initialPlot.querySelectorAll('circle')).toHaveLength(2);
    expect(initialPlot.querySelector('.volume-graph__line')).toHaveAttribute('d', expect.stringContaining('L'));

    fireEvent.mouseEnter(graph);
    fireEvent.mouseMove(graph);
    fireEvent.focus(graph);
    window.dispatchEvent(new Event('resize'));
    view.rerender(<VolumeGraph sessions={initialSessions.map((session) => ({ ...session, bestSet: { reps: 8 } }))} />);

    expect(screen.getByTestId('volume-graph-plot')).toBe(initialPlot);
    expect(screen.getByTestId('volume-graph-plot').querySelectorAll('circle')).toHaveLength(2);
  });

  test('replaces the plot once when meaningful chart data changes', () => {
    const view = render(<VolumeGraph sessions={initialSessions} />);
    const initialPlot = screen.getByTestId('volume-graph-plot');

    view.rerender(<VolumeGraph sessions={[
      initialSessions[0],
      { ...initialSessions[1], totalVolume: 1650 },
    ]} />);

    const updatedPlot = screen.getByTestId('volume-graph-plot');
    expect(updatedPlot).not.toBe(initialPlot);
    expect(updatedPlot.querySelectorAll('circle')).toHaveLength(2);
    expect(screen.getByRole('img', { name: /1,200 kg to 1,650 kg/i })).toBeInTheDocument();
  });

  test('renders the honest no-data state without a reveal target', () => {
    render(<VolumeGraph sessions={[initialSessions[0]]} />);

    expect(screen.getByText('Log at least 2 sessions to see your progress graph')).toBeInTheDocument();
    expect(screen.queryByTestId('volume-graph-plot')).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /volume over time/i })).not.toBeInTheDocument();
  });
});

describe('P2.4 chart reveal CSS contract', () => {
  test('uses one finite composited reveal without per-point sequencing', () => {
    const css = readExercisesCss();
    const plotRule = declarationsFor(css, '.volume-graph__plot');
    const pointRule = declarationsFor(css, '.volume-graph__point');
    const keyframes = blockFor(css, '@keyframes volume-graph-plot-reveal');

    expect(plotRule).toContain('animation: volume-graph-plot-reveal 300ms var(--motion-ease-enter) 1 both');
    expect(keyframes).toMatch(/opacity:/);
    expect(keyframes).toMatch(/clip-path:\s*inset/);
    expect(keyframes).not.toMatch(/width|height|margin|padding|top|right|bottom|left/);
    expect(pointRule).not.toMatch(/animation|transition-delay/);
    expect(css).not.toMatch(/volume-graph[^;{}]*infinite|transition\s*:\s*all/i);
  });

  test('makes the complete plot immediately visible and static under reduced motion', () => {
    const reducedCss = reducedMotionCss(readExercisesCss());
    const plotRule = declarationsFor(reducedCss, '.volume-graph__plot');

    expect(plotRule).toContain('animation: none');
    expect(plotRule).toContain('opacity: 1');
    expect(plotRule).toContain('clip-path: inset(0)');
  });
});
