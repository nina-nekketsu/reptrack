import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import History from './History';

jest.mock('../components/ExerciseLogModal', () => () => null);

function seedHistory() {
  const date = '2026-10-10T09:00:00.000Z';
  localStorage.setItem('exercises', JSON.stringify([
    { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest' },
  ]));
  localStorage.setItem('exerciseLogs', JSON.stringify({
    bench: [{ date, sets: [{ reps: 5, weight: 100 }], totalReps: 5, totalVolume: 500 }],
  }));
}

describe('History day detail shared dialog behavior', () => {
  beforeEach(() => {
    localStorage.clear();
    seedHistory();
  });

  test('traps focus, closes with Escape, restores focus, and preserves sheet classes', async () => {
    render(<History />);
    const trigger = screen.getByRole('button', { name: /1 exercise session/i });

    await userEvent.click(trigger);

    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAccessibleName();
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveClass('history-detail');
    expect(dialog.parentElement).toHaveClass('history-detail-backdrop');
    expect(dialog).toContainElement(document.activeElement);
    expect(document.body.style.overflow).toBe('hidden');
    expect(screen.getByRole('button', { name: 'Close day detail' })).toHaveFocus();
    await userEvent.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'Edit or delete' })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).toBe('');
    expect(trigger).toHaveFocus();
  });
});
