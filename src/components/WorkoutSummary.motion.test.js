import fs from 'fs';
import path from 'path';
import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WorkoutSummary from './WorkoutSummary';

jest.mock('../utils/timer', () => ({ vibrate: jest.fn() }));

const summary = {
  exerciseCount: 3,
  totalSets: 9,
  totalVolume: 4200,
  duration: 37 * 60 * 1000,
  improvements: [],
  regressions: [],
  maintainedCount: 2,
  firstTimeCount: 1,
};

function SummaryHarness({ onClose }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Show workout summary</button>
      {open && (
        <WorkoutSummary
          summary={summary}
          cardioMinutes={24}
          onClose={() => {
            onClose();
            setOpen(false);
          }}
        />
      )}
    </>
  );
}

function reducedMotionCss(source) {
  const marker = '@media (prefers-reduced-motion: reduce)';
  const blocks = [];
  let searchFrom = 0;

  while (searchFrom < source.length) {
    const markerIndex = source.indexOf(marker, searchFrom);
    if (markerIndex === -1) break;

    const openIndex = source.indexOf('{', markerIndex + marker.length);
    let depth = 1;
    let cursor = openIndex + 1;

    while (cursor < source.length && depth > 0) {
      if (source[cursor] === '{') depth += 1;
      if (source[cursor] === '}') depth -= 1;
      cursor += 1;
    }

    blocks.push(source.slice(openIndex + 1, cursor - 1));
    searchFrom = cursor;
  }

  return blocks.join('\n').replace(/\s+/g, ' ');
}

function declarationsFor(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`));
  return match ? match[1].replace(/\s+/g, ' ') : '';
}

describe('workout summary handoff', () => {
  test('exposes the complete dialog immediately and initially focuses Done', () => {
    render(<WorkoutSummary summary={summary} cardioMinutes={24} onClose={jest.fn()} />);

    expect(screen.getByRole('dialog', { name: /workout complete/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /workout complete/i })).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('4.2t')).toBeInTheDocument();
    expect(screen.getByText('37m')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Done' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.getByRole('button', { name: /share as text/i })).toHaveFocus();
  });

  test('closes on the first Escape without waiting for visual completion', () => {
    const onClose = jest.fn();
    render(<SummaryHarness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: /show workout summary/i });
    trigger.focus();
    fireEvent.click(trigger);

    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: /workout complete/i })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('uses one short finite reveal sequence with no delayed interaction logic', () => {
    const css = fs.readFileSync(path.join(__dirname, 'CoachComponents.css'), 'utf8');
    const source = fs.readFileSync(path.join(__dirname, 'WorkoutSummary.js'), 'utf8');

    expect(declarationsFor(css, '.workout-summary-overlay')).toMatch(/animation:\s*ws-summary-backdrop-in 180ms\b[^;]*\bboth/);
    expect(declarationsFor(css, '.workout-summary')).toMatch(/animation:\s*ws-summary-panel-in 220ms\b[^;]*\bboth/);
    expect(declarationsFor(css, '.ws-complete-check')).toMatch(/animation:\s*ws-summary-check-in 260ms\b[^;]*\bboth/);
    expect(declarationsFor(css, '.ws-stats')).toMatch(/animation:\s*ws-summary-stats-in 220ms\b[^;]*\bboth/);
    expect(css).toMatch(/@keyframes\s+ws-summary-panel-in[\s\S]*?from\s*\{[^}]*opacity:\s*0;[^}]*transform:\s*translateY\(8px\)/);
    expect(css).toMatch(/@keyframes\s+ws-summary-check-in[\s\S]*?from\s*\{[^}]*opacity:\s*0;[^}]*transform:\s*scale\(/);
    expect(css).not.toMatch(/animation[^;{}]*infinite/);
    expect(css).not.toMatch(/transition:\s*all\b/);
    expect(source).not.toMatch(/setTimeout|animationend|transitionend/i);
  });

  test('renders immediate stable summary states for reduced motion', () => {
    const css = fs.readFileSync(path.join(__dirname, 'CoachComponents.css'), 'utf8');
    const reducedCss = reducedMotionCss(css);

    ['.workout-summary-overlay', '.workout-summary', '.ws-complete-check', '.ws-stats'].forEach((selector) => {
      const declarations = declarationsFor(reducedCss, selector);
      expect(declarations).toMatch(/animation:\s*none/);
      expect(declarations).toMatch(/opacity:\s*1/);
      expect(declarations).toMatch(/transform:\s*none/);
    });
  });
});
