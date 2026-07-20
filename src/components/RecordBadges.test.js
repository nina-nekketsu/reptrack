import React from 'react';
import fs from 'fs';
import path from 'path';
import { render, screen } from '@testing-library/react';
import RecordBadges from './RecordBadges';

const storedRecords = { maxWeight: 100, maxReps: 10, maxVolume: 1000 };

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

function chipFor(label) {
  return screen.getByText(label).closest('.record-chip');
}

describe('RecordBadges P2.4 reveal behavior', () => {
  test('renders stored records immediately without celebrating initial load', () => {
    render(<RecordBadges records={storedRecords} />);

    expect(screen.getByText('100 kg')).toBeInTheDocument();
    expect(screen.getByText('10')).toBeInTheDocument();
    expect(screen.getByText('1,000 kg')).toBeInTheDocument();
    expect(document.querySelectorAll('.record-chip--new-record')).toHaveLength(0);
  });

  test('cues only the newly increased record identity during the mounted session', () => {
    const view = render(<RecordBadges records={storedRecords} />);
    const initialWeightChip = chipFor('Best Weight');
    const initialRepsChip = chipFor('Most Reps');

    view.rerender(<RecordBadges records={{ ...storedRecords, maxWeight: 105 }} />);

    const updatedWeightChip = chipFor('Best Weight');
    expect(screen.getByText('105 kg')).toBeInTheDocument();
    expect(updatedWeightChip).not.toBe(initialWeightChip);
    expect(updatedWeightChip).toHaveClass('record-chip--new-record');
    expect(chipFor('Most Reps')).toBe(initialRepsChip);
    expect(chipFor('Most Reps')).not.toHaveClass('record-chip--new-record');

    view.rerender(<RecordBadges records={{ ...storedRecords, maxWeight: 105 }} />);
    expect(chipFor('Best Weight')).toBe(updatedWeightChip);
    expect(chipFor('Best Weight')).not.toHaveClass('record-chip--new-record');
  });

  test('does not celebrate a lower value or a previously seen record identity', () => {
    const view = render(<RecordBadges records={storedRecords} />);

    view.rerender(<RecordBadges records={{ ...storedRecords, maxWeight: 90 }} />);
    expect(chipFor('Best Weight')).not.toHaveClass('record-chip--new-record');

    view.rerender(<RecordBadges records={storedRecords} />);
    expect(chipFor('Best Weight')).not.toHaveClass('record-chip--new-record');
  });

  test('keeps an empty record state free of fake celebratory content', () => {
    const view = render(<RecordBadges records={{ maxWeight: null, maxReps: null, maxVolume: null }} />);

    expect(document.querySelector('.record-badges')).not.toBeInTheDocument();

    view.rerender(<RecordBadges records={{ maxWeight: 60, maxReps: null, maxVolume: null }} />);
    expect(screen.getByText('60 kg')).toBeInTheDocument();
    expect(chipFor('Best Weight')).toHaveClass('record-chip--new-record');
  });
});

describe('P2.4 record cue CSS contract', () => {
  test('uses one finite opacity and scale cue without layout animation', () => {
    const css = readExercisesCss();
    const cueRule = declarationsFor(css, '.record-chip--new-record');
    const keyframes = blockFor(css, '@keyframes record-chip-new-record');

    expect(cueRule).toContain('animation: record-chip-new-record 180ms var(--motion-ease-enter) 1 both');
    expect(keyframes).toMatch(/opacity:/);
    expect(keyframes).toMatch(/transform:\s*scale/);
    expect(keyframes).not.toMatch(/width|height|margin|padding|top|right|bottom|left/);
    expect(css).not.toMatch(/record-chip[^;{}]*infinite|transition\s*:\s*all/i);
  });

  test('makes record cues immediately visible and static under reduced motion', () => {
    const reducedCss = reducedMotionCss(readExercisesCss());
    const cueRule = declarationsFor(reducedCss, '.record-chip--new-record');

    expect(cueRule).toContain('animation: none');
    expect(cueRule).toContain('opacity: 1');
    expect(cueRule).toContain('transform: none');
  });
});
