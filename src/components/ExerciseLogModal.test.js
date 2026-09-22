import fs from 'fs';
import path from 'path';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ExerciseLogModal from './ExerciseLogModal';
import { loadLogs } from '../utils/exerciseHelpers';

const mockVolumeGraph = jest.fn(() => <div data-testid="mock-volume-graph">Graph</div>);

beforeEach(() => {
  localStorage.clear();
  loadLogs();
});

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/CoachContext', () => ({ useCoach: () => ({ isOnboarded: false, coachActive: false, profile: {}, metadata: {} }) }));
jest.mock('./SetTimer', () => () => <div>Timer</div>);
jest.mock('./RecordBadges', () => () => <div>Records</div>);
jest.mock('./VolumeGraph', () => (props) => mockVolumeGraph(props));
jest.mock('./CoachFeedback', () => () => null);
jest.mock('./RestAdvisor', () => () => null);
jest.mock('../utils/buildInfo', () => ({ formatBuildId: () => 'test-build' }));

function readExercisesCss() {
  return fs.readFileSync(path.join(process.cwd(), 'src/pages/Exercises.css'), 'utf8');
}

function readCssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = readExercisesCss().match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'));
  return match?.[1] || '';
}

describe('ExerciseLogModal saved feedback', () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  test('reopens a logged set with a visible non-color progress cue', () => {
    localStorage.setItem('activeWorkoutSession', JSON.stringify({ planId: 'push-day', startedAt: '2026-07-14T08:00:00.000Z' }));
    const logs = { bench: [
      { date: '2026-07-10T08:30:00.000Z', sets: [{ reps: 10, weight: 80 }] },
      { date: '2026-07-14T09:00:00.000Z', sets: [{ reps: 11, weight: 80 }] },
    ] };
    localStorage.setItem('exerciseLogs', JSON.stringify(logs));
    render(<ExerciseLogModal exercise={{ id: 'bench', name: 'Bench Press', muscleGroup: 'Chest' }} logs={logs} onClose={() => {}} onSaved={() => {}} stayOpenOnSave />);
    expect(screen.getByText('More reps than last time')).toBeInTheDocument();
  });
});

describe('ExerciseLogModal progress graph integration', () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLElement.prototype.scrollTo = jest.fn();
    mockVolumeGraph.mockClear();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
  });

  test('wires the overview graph to the active exercise id and local-first sessions', () => {
    const logs = {
      bench: [{ date: '2026-07-01T08:00:00.000Z', totalReps: 5, totalVolume: 250, sets: [{ reps: 5, weight: 50 }] }],
      squat: [{ date: '2026-07-02T08:00:00.000Z', totalReps: 5, totalVolume: 500, sets: [{ reps: 5, weight: 100 }] }],
    };
    render(<ExerciseLogModal exercise={{ id: 'squat', name: 'Squat', muscleGroup: 'Legs' }} logs={logs} onClose={() => {}} onSaved={() => {}} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));

    expect(mockVolumeGraph).toHaveBeenLastCalledWith(expect.objectContaining({
      exerciseId: 'squat',
      sessions: logs.squat,
      loading: false,
      offline: false,
      error: null,
    }));
  });

  test('passes truthful loading, invalid-history error, and offline state without inventing remote graph fetches', () => {
    const { rerender } = render(<ExerciseLogModal exercise={{ id: 'bench', name: 'Bench', muscleGroup: 'Chest' }} logs={undefined} onClose={() => {}} onSaved={() => {}} initialTab="overview" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(mockVolumeGraph).toHaveBeenLastCalledWith(expect.objectContaining({ loading: true, error: null, offline: false }));

    rerender(<ExerciseLogModal exercise={{ id: 'bench', name: 'Bench', muscleGroup: 'Chest' }} logs={{ bench: { unreadable: true } }} onClose={() => {}} onSaved={() => {}} initialTab="overview" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(mockVolumeGraph).toHaveBeenLastCalledWith(expect.objectContaining({ loading: false, error: 'invalid-history', offline: false }));

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    act(() => window.dispatchEvent(new Event('offline')));
    rerender(<ExerciseLogModal exercise={{ id: 'bench', name: 'Bench', muscleGroup: 'Chest' }} logs={{ bench: [] }} onClose={() => {}} onSaved={() => {}} initialTab="overview" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(mockVolumeGraph).toHaveBeenLastCalledWith(expect.objectContaining({ loading: false, error: null, offline: true }));
  });

  test('resets graph props when changing exercises', () => {
    const logs = {
      bench: [{ date: '2026-07-01T08:00:00.000Z', totalReps: 5, totalVolume: 250, sets: [{ reps: 5, weight: 50 }] }],
      squat: [{ date: '2026-07-02T08:00:00.000Z', totalReps: 5, totalVolume: 500, sets: [{ reps: 5, weight: 100 }] }],
    };
    const { rerender } = render(<ExerciseLogModal exercise={{ id: 'bench', name: 'Bench', muscleGroup: 'Chest' }} logs={logs} onClose={() => {}} onSaved={() => {}} initialTab="overview" />);
    expect(mockVolumeGraph).toHaveBeenLastCalledWith(expect.objectContaining({ exerciseId: 'bench', sessions: logs.bench }));

    rerender(<ExerciseLogModal exercise={{ id: 'squat', name: 'Squat', muscleGroup: 'Legs' }} logs={logs} onClose={() => {}} onSaved={() => {}} initialTab="overview" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(mockVolumeGraph).toHaveBeenLastCalledWith(expect.objectContaining({ exerciseId: 'squat', sessions: logs.squat }));
  });
});

describe('ExerciseLogModal session identity', () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  test('adds a durable clientSessionId to newly saved local sessions', async () => {
    render(<ExerciseLogModal exercise={{ id: 'bench', name: 'Bench', muscleGroup: 'Chest' }} logs={{}} onClose={() => {}} onSaved={() => {}} stayOpenOnSave />);
    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    fireEvent.change(inputs[1], { target: { value: '50' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Done' })));

    const saved = JSON.parse(localStorage.getItem('exerciseLogs'));
    expect(saved.bench[0].clientSessionId).toMatch(/^client-session-/);
  });

  test('preserves an existing clientSessionId when editing a session', async () => {
    const logs = { bench: [{ date: '2026-07-01T08:00:00.000Z', clientSessionId: 'client-session-existing', totalReps: 5, totalVolume: 250, sets: [{ reps: 5, weight: 50 }] }] };
    localStorage.setItem('exerciseLogs', JSON.stringify(logs));
    render(<ExerciseLogModal exercise={{ id: 'bench', name: 'Bench', muscleGroup: 'Chest' }} logs={logs} onClose={() => {}} onSaved={() => {}} stayOpenOnSave initialTab="overview" />);
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    fireEvent.change(screen.getAllByRole('spinbutton')[0], { target: { value: '6' } });
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Done' })));

    const saved = JSON.parse(localStorage.getItem('exerciseLogs'));
    expect(saved.bench).toHaveLength(1);
    expect(saved.bench[0].clientSessionId).toBe('client-session-existing');
    expect(saved.bench[0].totalReps).toBe(6);
  });
});

describe('ExerciseLogModal set reordering', () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  test('moves a set with the keyboard while keeping its values together', () => {
    render(
      <ExerciseLogModal
        exercise={{ id: 'squat', name: 'Squat', muscleGroup: 'Legs' }}
        logs={{}}
        onClose={() => {}}
        onSaved={() => {}}
        prescribedSets={3}
        stayOpenOnSave
      />
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '100' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 2 reps' }), { target: { value: '8' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 2 weight' }), { target: { value: '80' } });

    fireEvent.keyDown(screen.getByRole('button', { name: /Reorder set 1/i }), { key: 'ArrowDown' });

    expect(screen.getByRole('spinbutton', { name: 'Set 1 reps' })).toHaveValue(8);
    expect(screen.getByRole('spinbutton', { name: 'Set 1 weight' })).toHaveValue(80);
    expect(screen.getByRole('spinbutton', { name: 'Set 2 reps' })).toHaveValue(5);
    expect(screen.getByRole('spinbutton', { name: 'Set 2 weight' })).toHaveValue(100);
  });

  test('long-press drag moves a set to the touched row', () => {
    jest.useFakeTimers();
    const originalElementFromPoint = document.elementFromPoint;
    const view = render(
      <ExerciseLogModal
        exercise={{ id: 'squat', name: 'Squat', muscleGroup: 'Legs' }}
        logs={{}}
        onClose={() => {}}
        onSaved={() => {}}
        prescribedSets={3}
        stayOpenOnSave
      />
    );

    try {
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '5' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 2 reps' }), { target: { value: '8' } });
      document.elementFromPoint = jest.fn(() => (
        screen.getByRole('spinbutton', { name: 'Set 2 reps' }).closest('.set-row')
      ));

      const reorderHandle = screen.getByRole('button', { name: /Reorder set 1/i });
      const scroller = view.container.querySelector('.log-scroll-body');
      scroller.getBoundingClientRect = () => ({ top: 0, bottom: 100, left: 0, right: 320, width: 320, height: 100 });
      Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 });
      reorderHandle.setPointerCapture = jest.fn();
      reorderHandle.releasePointerCapture = jest.fn();
      reorderHandle.hasPointerCapture = jest.fn(() => true);
      fireEvent.pointerDown(reorderHandle, {
        pointerId: 7,
        pointerType: 'touch',
        button: 0,
        clientX: 10,
        clientY: 10,
      });
      expect(reorderHandle.setPointerCapture).toHaveBeenCalledTimes(1);
      act(() => jest.advanceTimersByTime(450));
      const pointerMove = new Event('pointermove', { bubbles: true, cancelable: true });
      Object.defineProperties(pointerMove, {
        pointerId: { value: 7 },
        pointerType: { value: 'mouse' },
        clientX: { value: 10 },
        clientY: { value: 80 },
      });
      fireEvent(scroller, pointerMove);
      expect(scroller.scrollTop).toBeGreaterThan(0);
      fireEvent.pointerUp(scroller, { pointerId: 7 });
      expect(reorderHandle.releasePointerCapture).toHaveBeenCalledTimes(1);

      expect(screen.getByRole('spinbutton', { name: 'Set 1 reps' })).toHaveValue(8);
      expect(screen.getByRole('spinbutton', { name: 'Set 2 reps' })).toHaveValue(5);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      jest.useRealTimers();
    }
  });

  test('allows pre-hold touch scrolling, then reorders and auto-scrolls after activation', () => {
    jest.useFakeTimers();
    const originalElementFromPoint = document.elementFromPoint;
    const view = render(
      <ExerciseLogModal
        exercise={{ id: 'squat', name: 'Squat', muscleGroup: 'Legs' }}
        logs={{}}
        onClose={() => {}}
        onSaved={() => {}}
        prescribedSets={3}
      />
    );
    const handle = screen.getByRole('button', { name: /Reorder set 1/i });
    const scroller = view.container.querySelector('.log-scroll-body');
    scroller.getBoundingClientRect = () => ({ top: 0, bottom: 200, left: 0, right: 320, width: 320, height: 200 });
    Object.defineProperty(scroller, 'scrollTop', { configurable: true, writable: true, value: 0 });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 2 reps' }), { target: { value: '8' } });
    document.elementFromPoint = jest.fn(() => (
      screen.getByRole('spinbutton', { name: 'Set 2 reps' }).closest('.set-row')
    ));

    try {
      fireEvent.touchStart(handle, {
        touches: [{ identifier: 21, clientX: 10, clientY: 100 }],
      });
      const earlyMove = new Event('touchmove', { bubbles: true, cancelable: true });
      Object.defineProperty(earlyMove, 'touches', {
        value: [{ identifier: 21, clientX: 10, clientY: 120 }],
      });
      document.dispatchEvent(earlyMove);
      expect(earlyMove.defaultPrevented).toBe(false);

      fireEvent.touchStart(handle, {
        touches: [{ identifier: 22, clientX: 10, clientY: 100 }],
      });
      act(() => jest.advanceTimersByTime(450));
      const activeMove = new Event('touchmove', { bubbles: true, cancelable: true });
      Object.defineProperty(activeMove, 'touches', {
        value: [{ identifier: 22, clientX: 10, clientY: 190 }],
      });
      act(() => {
        document.dispatchEvent(activeMove);
      });

      expect(activeMove.defaultPrevented).toBe(true);
      expect(scroller.scrollTop).toBeGreaterThan(0);
      expect(screen.getByRole('spinbutton', { name: 'Set 1 reps' })).toHaveValue(8);
      expect(screen.getByRole('spinbutton', { name: 'Set 2 reps' })).toHaveValue(5);
      act(() => {
        document.dispatchEvent(new Event('touchend', { bubbles: true }));
      });
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      jest.useRealTimers();
    }
  });

  test('moves a dropset parent together with its child rows', () => {
    const view = render(
      <ExerciseLogModal
        exercise={{ id: 'squat', name: 'Squat', muscleGroup: 'Legs' }}
        logs={{}}
        onClose={() => {}}
        onSaved={() => {}}
        prescribedSets={2}
        stayOpenOnSave
      />
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '8' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '100' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 2 reps' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 2 weight' }), { target: { value: '120' } });
    fireEvent.change(screen.getByRole('combobox', { name: 'Set 1 type' }), { target: { value: 'dropset' } });

    const dropsetHandle = screen.getByRole('button', { name: /Reorder set 1\./i });
    expect(screen.getAllByRole('button', { name: /Reorder set/i })).toHaveLength(2);
    expect(dropsetHandle).toHaveAccessibleName(/Position 1 of 2/i);
    fireEvent.keyDown(dropsetHandle, { key: 'ArrowDown' });

    const rows = Array.from(view.container.querySelectorAll('.set-row'));
    expect(rows[0].querySelector('input[aria-label$="reps"]')).toHaveValue(5);
    expect(rows[1].querySelector('select')).toHaveValue('dropset');
    expect(rows[1].querySelector('input[aria-label$="reps"]')).toHaveValue(8);
    expect(rows[2]).toHaveClass('set-row--dropset-child');
    expect(rows[3]).toHaveClass('set-row--dropset-child');
  });

  test('keeps dragging the same set across differently sized set groups', () => {
    jest.useFakeTimers();
    const originalElementFromPoint = document.elementFromPoint;
    const view = render(
      <ExerciseLogModal
        exercise={{ id: 'squat', name: 'Squat', muscleGroup: 'Legs' }}
        logs={{}}
        onClose={() => {}}
        onSaved={() => {}}
        prescribedSets={3}
      />
    );

    try {
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '8' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '100' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 2 reps' }), { target: { value: '5' } });
      fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 3 reps' }), { target: { value: '3' } });
      fireEvent.change(screen.getByRole('combobox', { name: 'Set 1 type' }), { target: { value: 'dropset' } });

      let hoveredRow = view.container.querySelector('.set-row--dropset-child');
      document.elementFromPoint = jest.fn(() => hoveredRow);
      fireEvent.pointerDown(screen.getByRole('button', { name: /Reorder set 3\./i }), {
        pointerId: 11,
        pointerType: 'touch',
        button: 0,
        clientX: 10,
        clientY: 200,
      });
      act(() => jest.advanceTimersByTime(450));
      fireEvent.pointerMove(view.container.querySelector('.log-scroll-body'), {
        pointerId: 11,
        pointerType: 'touch',
        clientX: 10,
        clientY: 80,
      });

      hoveredRow = Array.from(view.container.querySelectorAll('.set-row')).find((row) => (
        row.querySelector('input[aria-label$="reps"]')?.value === '5'
      ));
      fireEvent.pointerMove(view.container.querySelector('.log-scroll-body'), {
        pointerId: 11,
        pointerType: 'touch',
        clientX: 10,
        clientY: 180,
      });
      fireEvent.pointerUp(view.container.querySelector('.log-scroll-body'), { pointerId: 11 });

      const primaryReps = Array.from(view.container.querySelectorAll('.set-row:not(.set-row--dropset-child)'))
        .map((row) => row.querySelector('input[aria-label$="reps"]')?.value);
      expect(primaryReps).toEqual(['8', '5', '3']);
    } finally {
      document.elementFromPoint = originalElementFromPoint;
      jest.useRealTimers();
    }
  });

  test('persists the reordered set sequence when the log is saved', async () => {
    render(
      <ExerciseLogModal
        exercise={{ id: 'squat', name: 'Squat', muscleGroup: 'Legs' }}
        logs={{}}
        onClose={() => {}}
        onSaved={() => {}}
        prescribedSets={2}
        stayOpenOnSave
      />
    );

    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '5' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '100' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 2 reps' }), { target: { value: '8' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 2 weight' }), { target: { value: '80' } });
    fireEvent.keyDown(screen.getByRole('button', { name: /Reorder set 1/i }), { key: 'ArrowDown' });

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Done' })));

    const saved = JSON.parse(localStorage.getItem('exerciseLogs'));
    expect(saved.squat[0].sets.map(({ reps, weight }) => [reps, weight]))
      .toEqual([['8', '80'], ['5', '100']]);
  });

  test('shows a visible touch instruction and a touch-safe reorder handle', () => {
    render(
      <ExerciseLogModal
        exercise={{ id: 'squat', name: 'Squat', muscleGroup: 'Legs' }}
        logs={{}}
        onClose={() => {}}
        onSaved={() => {}}
        prescribedSets={2}
      />
    );

    expect(screen.getByText('Hold a set number, then drag to move it.')).toBeInTheDocument();
    expect(readCssRule('.set-reorder-handle')).toContain('touch-action: auto');
    expect(readCssRule('.set-reorder-handle')).toContain('min-width: 44px');
    expect(readCssRule('.set-reorder-handle')).toContain('min-height: 44px');
    expect(readExercisesCss()).toContain('grid-template-columns: 44px minmax(0, 1fr) minmax(0, 1fr);');
    expect(readExercisesCss()).toContain('grid-template-columns: 44px minmax(0, 1fr) 44px;');
    expect(readExercisesCss()).not.toContain('grid-template-columns: 44px minmax(132px, 1fr) minmax(132px, 1fr);');
    expect(readCssRule('.set-row--dragging')).toContain('border-color: var(--go)');
  });
});

describe('ExerciseLogModal Done button state contract', () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  test('keeps Done disabled until the visible set has saveable values', () => {
    render(
      <ExerciseLogModal
        exercise={{ id: 'leg-press', name: 'Single Leg Press Sideways', muscleGroup: 'Legs' }}
        logs={{}}
        onClose={() => {}}
        onSaved={() => {}}
        stayOpenOnSave
      />
    );

    const doneButton = screen.getByRole('button', { name: 'Done' });
    expect(doneButton).toBeDisabled();

    const inputs = screen.getAllByRole('spinbutton');
    fireEvent.change(inputs[0], { target: { value: '15' } });
    fireEvent.change(inputs[1], { target: { value: '86' } });

    expect(doneButton).toBeEnabled();
  });

  test('styles disabled and enabled Done as readable, distinct states with reduced-motion support', () => {
    const disabledRule = readCssRule('.modal--log .log-actions .btn-primary:disabled');
    const enabledRule = readCssRule('.modal--log .log-actions .btn-primary:not(:disabled)');
    const css = readExercisesCss();

    expect(disabledRule).toContain('background: var(--bg-1) !important');
    expect(disabledRule).toContain('color: var(--ink-mid) !important');
    expect(disabledRule).not.toContain('color: var(--ink-low)');
    expect(disabledRule).toContain('border: 1px solid var(--line-strong)');
    expect(disabledRule).toContain('opacity: 1');
    expect(enabledRule).toContain('background: var(--go) !important');
    expect(enabledRule).toContain('color: var(--ink-on-accent) !important');
    expect(enabledRule).toContain('animation: done-ready-cue');
    expect(css).toContain('@keyframes done-ready-cue');
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.modal--log \.log-actions \.btn-primary:not\(:disabled\)\s*\{[\s\S]*animation:\s*none/);
  });
});
