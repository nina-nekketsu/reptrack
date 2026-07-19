import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen } from '@testing-library/react';
import ExerciseLogModal from './ExerciseLogModal';

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/CoachContext', () => ({ useCoach: () => ({ isOnboarded: false, coachActive: false, profile: {}, metadata: {} }) }));
jest.mock('./SetTimer', () => () => <div>Timer</div>);
jest.mock('./RecordBadges', () => () => <div>Records</div>);
jest.mock('./VolumeGraph', () => () => <div>Graph</div>);
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
