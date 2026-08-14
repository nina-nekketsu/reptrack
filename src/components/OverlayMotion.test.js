import fs from 'fs';
import path from 'path';
import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import Dialog from './ui/Dialog';
import Sheet from './Sheet';
import Toast from './Toast';

function readCss(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), 'src', relativePath), 'utf8');
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

function DialogHarness({ onClose }) {
  const [open, setOpen] = useState(true);
  return (
    <Dialog
      open={open}
      onClose={() => {
        onClose();
        setOpen(false);
      }}
      title="Delete workout"
    >
      <button type="button">Keep workout</button>
    </Dialog>
  );
}

function ToastHarness({ onAction }) {
  const [open, setOpen] = useState(true);
  return (
    <Toast
      open={open}
      message="Set removed"
      actionLabel="Undo"
      onAction={() => {
        onAction();
        setOpen(false);
      }}
    />
  );
}

describe('shared overlay motion behavior', () => {
  test('Dialog closes on backdrop immediately and invokes its callback once', () => {
    const onClose = jest.fn();
    render(<DialogHarness onClose={onClose} />);

    fireEvent.mouseDown(document.querySelector('.ui-dialog-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog', { name: 'Delete workout' })).not.toBeInTheDocument();
  });

  test('Dialog portals sheets to the document body so they escape transformed modal ancestors', () => {
    const onClose = jest.fn();
    const { container } = render(
      <div data-testid="transformed-sheet-ancestor">
        <Sheet open onClose={onClose} title="Choose rest duration">
          <button type="button">90 seconds</button>
        </Sheet>
      </div>
    );
    Object.assign(screen.getByTestId('transformed-sheet-ancestor').style, {
      transform: 'translateY(0)',
      overflow: 'hidden',
    });

    const backdrop = document.querySelector('.sheet-backdrop');
    expect(backdrop).toBeInTheDocument();
    expect(backdrop.parentElement).toBe(document.body);
    expect(container).not.toContainElement(backdrop);
  });

  test('Sheet keeps swipe dismissal immediate without adding a second close path', () => {
    const onClose = jest.fn();
    render(
      <Sheet open onClose={onClose} title="Rest options">
        <button type="button">90 seconds</button>
      </Sheet>
    );
    const content = document.querySelector('.sheet-panel__content');
    Object.defineProperty(content, 'scrollTop', { configurable: true, value: 0 });

    fireEvent.touchStart(content, { touches: [{ clientX: 100, clientY: 100 }] });
    fireEvent.touchEnd(content, { changedTouches: [{ clientX: 110, clientY: 190 }] });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Toast removes live semantics immediately, then bounds visual exit cleanup', () => {
    jest.useFakeTimers();
    try {
      const onAction = jest.fn();
      const { container } = render(<ToastHarness onAction={onAction} />);

      expect(screen.getAllByRole('status')).toHaveLength(1);
      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));

      expect(onAction).toHaveBeenCalledTimes(1);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
      expect(screen.queryByText('Set removed')).not.toBeInTheDocument();
      expect(container.querySelector('.toast')).toHaveClass('toast--exit');
      expect(container.querySelector('.toast')).toHaveAttribute('aria-hidden', 'true');

      act(() => jest.advanceTimersByTime(139));
      expect(container.querySelector('.toast')).toBeInTheDocument();
      act(() => jest.advanceTimersByTime(1));
      expect(container.querySelector('.toast')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  test('Toast expiry preserves a visual fade without extending the Undo window or announcing twice', () => {
    jest.useFakeTimers();
    try {
      const { container, rerender } = render(
        <Toast open message="Set removed" actionLabel="Undo" onAction={jest.fn()} />
      );
      expect(screen.getAllByRole('status')).toHaveLength(1);

      rerender(<Toast open={false} message="Set removed" actionLabel="Undo" onAction={jest.fn()} />);

      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Undo' })).not.toBeInTheDocument();
      expect(container.querySelector('.toast')).toHaveClass('toast--exit');
      expect(container.querySelector('.toast')).toHaveTextContent('Set removed');
      expect(container.querySelectorAll('[aria-live]')).toHaveLength(0);

      act(() => jest.advanceTimersByTime(140));
      expect(container.querySelector('.toast')).not.toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  test('Toast reduced-motion exit cleanup completes on the next bounded task', () => {
    jest.useFakeTimers();
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({ matches: true })),
    });

    try {
      const { container, rerender } = render(<Toast open message="Saved" />);
      rerender(<Toast open={false} message="Saved" />);

      expect(container.querySelector('.toast')).toHaveClass('toast--exit');
      act(() => jest.runOnlyPendingTimers());
      expect(container.querySelector('.toast')).not.toBeInTheDocument();
    } finally {
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: originalMatchMedia,
      });
      jest.useRealTimers();
    }
  });
});

describe('shared overlay motion CSS contract', () => {
  test('Dialog uses finite backdrop and six-pixel panel reveals', () => {
    const css = readCss('components/ui/ui.css');

    expect(declarationsFor(css, '.ui-dialog-backdrop')).toMatch(
      /animation:\s*ui-dialog-backdrop-in 160ms\b[^;]*\bboth/
    );
    expect(declarationsFor(css, '.ui-dialog-panel')).toMatch(
      /animation:\s*ui-dialog-panel-in 180ms\b[^;]*\bboth/
    );
    expect(css).toMatch(
      /@keyframes\s+ui-dialog-panel-in[\s\S]*?from\s*\{[^}]*opacity:\s*0;[^}]*transform:\s*translateY\(6px\)/
    );
  });

  test('Sheet overrides the shared reveal with its finite sheet timings', () => {
    const css = readCss('components/Sheet.css');

    expect(declarationsFor(css, '.sheet-backdrop')).toMatch(
      /animation:\s*sheet-backdrop-in 180ms\b[^;]*\bboth/
    );
    expect(declarationsFor(css, '.sheet-panel')).toMatch(
      /animation:\s*sheet-panel-in 240ms\b[^;]*\bboth/
    );
    expect(css).toMatch(
      /@keyframes\s+sheet-panel-in[\s\S]*?from\s*\{[^}]*transform:\s*translateY\(var\(--motion-distance-sheet\)\)/
    );
  });

  test('Toast has one finite enter and bounded fade-only exit', () => {
    const css = readCss('pages/Exercises.css');
    const source = fs.readFileSync(path.join(process.cwd(), 'src/components/Toast.js'), 'utf8');

    expect(declarationsFor(css, '.toast--enter')).toMatch(
      /animation:\s*exercise-toast-enter 180ms\b[^;]*\bboth/
    );
    expect(declarationsFor(css, '.toast--exit')).toMatch(
      /animation:\s*exercise-toast-exit 140ms\b[^;]*\bboth/
    );
    expect(css).toMatch(
      /@keyframes\s+exercise-toast-enter[\s\S]*?from\s*\{[^}]*opacity:\s*0;[^}]*translate\(-50%,\s*var\(--motion-distance-reveal\)\)/
    );
    expect(blockFor(css, '@keyframes exercise-toast-exit')).not.toMatch(/translateY|scale/);
    expect(source).toContain('TOAST_EXIT_MS = 140');
  });

  test('reduced motion exposes stable overlay endpoints and all motion stays finite', () => {
    const dialogCss = readCss('components/ui/ui.css');
    const sheetCss = readCss('components/Sheet.css');
    const toastCss = readCss('pages/Exercises.css');
    const dialogReduced = reducedMotionCss(dialogCss);
    const sheetReduced = reducedMotionCss(sheetCss);
    const toastReduced = reducedMotionCss(toastCss);
    const combinedCss = `${dialogCss}\n${sheetCss}\n${toastCss}`;

    expect(declarationsFor(dialogReduced, '.ui-dialog-backdrop')).toMatch(/animation:\s*none/);
    expect(declarationsFor(dialogReduced, '.ui-dialog-panel')).toMatch(/animation:\s*none/);
    expect(declarationsFor(sheetReduced, '.sheet-backdrop')).toMatch(/animation:\s*none/);
    expect(declarationsFor(sheetReduced, '.sheet-panel')).toMatch(/animation:\s*none/);
    expect(declarationsFor(toastReduced, '.toast--enter')).toMatch(/animation:\s*none/);
    expect(declarationsFor(toastReduced, '.toast--exit')).toMatch(/animation:\s*none/);
    expect(declarationsFor(toastReduced, '.toast--exit')).toMatch(/opacity:\s*0/);
    expect(combinedCss).not.toMatch(/animation[^;{}]*infinite/);
    expect(combinedCss).not.toMatch(/transition:\s*all\b/);
  });
});
