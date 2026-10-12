import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseLogModal from './ExerciseLogModal';

jest.mock('./SetTimer', () => () => <div>Timer</div>);
jest.mock('./RecordBadges', () => () => null);
jest.mock('./VolumeGraph', () => () => null);
jest.mock('./CoachFeedback', () => () => null);
jest.mock('./RestAdvisor', () => () => null);
jest.mock('../utils/buildInfo', () => ({ formatBuildId: () => 'test' }));
jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('../context/CoachContext', () => ({
  useCoach: () => ({ isOnboarded: false, coachActive: false, profile: {}, metadata: {} }),
}));

const exercise = { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest' };

function Harness({ logs = {} }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open exercise log</button>
      {open && (
        <ExerciseLogModal
          exercise={exercise}
          logs={logs}
          onClose={() => setOpen(false)}
          onSaved={() => {}}
        />
      )}
    </>
  );
}

describe('ExerciseLogModal shared dialog behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  test('labels and traps the logging sheet, closes with Escape, and restores trigger focus', async () => {
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: 'Open exercise log' });

    await userEvent.click(trigger);

    const dialog = screen.getByRole('dialog', { name: 'Bench Press' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('modal', 'modal--log');
    expect(dialog.parentElement).toHaveClass('modal-overlay');
    expect(document.body.style.overflow).toBe('hidden');
    expect(dialog).toContainElement(document.activeElement);
    expect(screen.getByRole('tab', { name: 'Log' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Bench Press' })).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
  });

  test('only closes the nested delete confirmation on the first Escape and returns focus to its trigger', async () => {
    const session = {
      date: '2026-10-10T09:00:00.000Z',
      sets: [{ reps: 5, weight: 100 }],
      totalReps: 5,
      totalVolume: 500,
    };
    const logs = { bench: [session] };
    localStorage.setItem('exerciseLogs', JSON.stringify(logs));
    render(<Harness logs={logs} />);
    const trigger = screen.getByRole('button', { name: 'Open exercise log' });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    const deleteTrigger = screen.getByRole('button', { name: 'Delete session' });

    await userEvent.click(deleteTrigger);

    expect(screen.getByRole('dialog', { name: 'Delete this session?' })).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Bench Press' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Delete this session?' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Bench Press' })).toBeInTheDocument();
    expect(deleteTrigger).toHaveFocus();
    expect(document.body.style.overflow).toBe('hidden');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Bench Press' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
