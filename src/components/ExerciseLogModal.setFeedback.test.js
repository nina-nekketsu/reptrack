import React from 'react';
import fs from 'fs';
import path from 'path';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ExerciseLogModal from './ExerciseLogModal';

jest.mock('./SetTimer', () => () => null);
jest.mock('./RecordBadges', () => () => null);
jest.mock('./VolumeGraph', () => () => null);
jest.mock('./CoachFeedback', () => () => null);
jest.mock('./RestAdvisor', () => () => null);
jest.mock('../utils/buildInfo', () => ({ formatBuildId: () => 'test' }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/CoachContext', () => ({
  useCoach: () => ({
    isOnboarded: false,
    coachActive: false,
    profile: {},
    metadata: {},
  }),
}));

const exercise = { id: 'exercise-1', name: 'Squat', muscleGroup: 'Legs' };

function renderModal(props = {}) {
  return render(
    <ExerciseLogModal
      exercise={exercise}
      logs={{}}
      onSaved={jest.fn()}
      onClose={jest.fn()}
      stayOpenOnSave
      {...props}
    />
  );
}

function enterSet() {
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), {
    target: { value: '5' },
  });
  fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), {
    target: { value: '80' },
  });
}

function readExercisesCss() {
  return fs.readFileSync(path.join(process.cwd(), 'src/pages/Exercises.css'), 'utf8');
}

function readCssRule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`, 's'));
  return match?.[1] || '';
}

describe('ExerciseLogModal P1.2 set feedback', () => {
  beforeAll(() => {
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  beforeEach(() => {
    localStorage.clear();
  });

  test('keeps aria-pressed authoritative while checked styling and acknowledgement reverse immediately', () => {
    renderModal();
    enterSet();

    const doneButton = screen.getByRole('button', { name: 'Mark set 1 done' });
    const row = doneButton.closest('.set-row');

    fireEvent.click(doneButton);

    expect(doneButton).toHaveAttribute('aria-pressed', 'true');
    expect(row).toHaveClass('set-row--checked');
    expect(doneButton.querySelector('.set-done-btn__check')).toBeInTheDocument();

    fireEvent.click(doneButton);

    expect(doneButton).toHaveAttribute('aria-pressed', 'false');
    expect(row).not.toHaveClass('set-row--checked');
    expect(doneButton.querySelector('.set-done-btn__check')).not.toBeInTheDocument();
  });

  test('announces a truthful local save only after the local session is durable', async () => {
    renderModal();
    enterSet();

    expect(screen.queryByText('Saved on this device')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    const savedStatus = await screen.findByText('Saved on this device');
    const storedLogs = JSON.parse(localStorage.getItem('exerciseLogs'));

    expect(storedLogs[exercise.id]).toHaveLength(1);
    expect(savedStatus).toHaveAttribute('role', 'status');
    expect(savedStatus).toHaveAttribute('aria-live', 'polite');
    expect(screen.queryByText(/^Synced$/i)).not.toBeInTheDocument();
  });

  test('cues exercise completion only on a new incomplete-to-complete transition', async () => {
    const baseProps = {
      exercise,
      logs: {},
      onSaved: jest.fn(),
      onClose: jest.fn(),
      stayOpenOnSave: true,
      prescribedSets: 1,
      onCompletionChange: jest.fn(),
    };
    const view = render(<ExerciseLogModal {...baseProps} isExerciseDone />);

    expect(screen.getByText('Exercise complete')).not.toHaveClass('set-completion-summary--cue');

    view.rerender(<ExerciseLogModal {...baseProps} isExerciseDone={false} />);
    expect(screen.queryByText('Exercise complete')).not.toBeInTheDocument();

    view.rerender(<ExerciseLogModal {...baseProps} isExerciseDone />);
    await waitFor(() => {
      expect(screen.getByText('Exercise complete')).toHaveClass('set-completion-summary--cue');
    });

    const completionStatus = screen.getByText('Exercise complete');
    view.rerender(<ExerciseLogModal {...baseProps} isExerciseDone logs={{ unrelated: [] }} />);
    expect(screen.getByText('Exercise complete')).toBe(completionStatus);
  });
});

describe('P1.2 motion CSS contract', () => {
  test('uses finite transform/opacity acknowledgement and explicit paint-only row transitions', () => {
    const css = readExercisesCss();
    const checkedRowRule = readCssRule(css, '.set-row--checked');
    const checkRule = readCssRule(css, '.set-done-btn__check');

    expect(checkedRowRule).toContain('background-color: var(--go-dim)');
    expect(checkedRowRule).toContain('border-color: var(--go)');
    expect(checkedRowRule).toContain('background-color 180ms var(--motion-ease-standard)');
    expect(checkedRowRule).toContain('border-color 180ms var(--motion-ease-standard)');
    expect(checkedRowRule).not.toMatch(/box-shadow|width|height|margin|padding/);
    expect(checkRule).toContain('animation: exercise-set-check-ack var(--motion-duration-control) var(--motion-ease-enter) 1 both');
    expect(css).toContain('@keyframes exercise-set-check-ack');
    expect(checkRule).not.toContain('infinite');
  });

  test('gives local save, exercise complete, and Undo finite motion with static reduced-motion states', () => {
    const css = readExercisesCss();
    const localSaveRule = readCssRule(css, '.local-save-status');
    const completionCueRule = readCssRule(css, '.set-completion-summary--cue');
    const toastEnterRule = readCssRule(css, '.toast--enter');
    const toastExitRule = readCssRule(css, '.toast--exit');

    expect(localSaveRule).toContain('animation: exercise-local-save-enter var(--motion-duration-control) var(--motion-ease-enter) 1 both');
    expect(completionCueRule).toContain('animation: exercise-complete-cue var(--motion-duration-sheet) var(--motion-ease-enter) 1 both');
    expect(toastEnterRule).toContain('animation: exercise-toast-enter 180ms var(--motion-ease-enter) 1 both');
    expect(toastExitRule).toContain('animation: exercise-toast-exit 140ms var(--motion-ease-exit) 1 both');
    expect(css).toContain('@keyframes exercise-toast-enter');
    expect(css).toContain('@keyframes exercise-toast-exit');
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.set-done-btn__check,[\s\S]*\.local-save-status,[\s\S]*\.set-completion-summary--cue\s*\{[\s\S]*animation:\s*none;[\s\S]*transform:\s*none;/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.toast--enter\s*\{[\s\S]*animation:\s*none;[\s\S]*opacity:\s*1;/);
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.toast--exit\s*\{[\s\S]*animation:\s*none;[\s\S]*opacity:\s*0;/);
  });
});
