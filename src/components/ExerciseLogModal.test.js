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
