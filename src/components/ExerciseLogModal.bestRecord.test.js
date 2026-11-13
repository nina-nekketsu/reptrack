import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
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

const exercise = { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest' };

function renderModal(logs, props = {}) {
  localStorage.setItem('exerciseLogs', JSON.stringify(logs));
  return render(
    <ExerciseLogModal
      exercise={exercise}
      logs={logs}
      onClose={jest.fn()}
      onSaved={jest.fn()}
      stayOpenOnSave
      {...props}
    />
  );
}

describe('ExerciseLogModal all-time best helper', () => {
  beforeEach(() => {
    localStorage.clear();
    HTMLElement.prototype.scrollTo = jest.fn();
  });

  test('renders the all-time Best for each logical primary set', () => {
    const logs = { bench: [
      {
        date: '2026-07-01T08:00:00.000Z',
        sets: [
          { reps: 8, weight: 60, setType: 'warmup' },
          { reps: 8, weight: 100, setType: 'normal' },
          { reps: 8, weight: 75, setType: 'dropset_child', dropSetChild: true },
          { reps: 8, weight: 90, setType: 'normal' },
        ],
      },
      {
        date: '2026-07-02T08:00:00.000Z',
        sets: [{ reps: 8, weight: 105 }, { reps: 8, weight: 95 }],
      },
    ] };

    renderModal(logs);

    expect(screen.getByText('Best: 8 reps · 105 kg')).toBeInTheDocument();
    expect(screen.getByText('Best: 8 reps · 95 kg')).toBeInTheDocument();
    expect(screen.queryByText(/^Last:/)).not.toBeInTheDocument();
  });

  test('shows older best reps and weight even when the latest session has different reps', () => {
    const logs = { bench: [
      { date: '2026-07-01', sets: [{ reps: 12, weight: 60 }, { reps: 10, weight: 55 }] },
      { date: '2026-07-02', sets: [{ reps: 9, weight: 50 }, { reps: 5, weight: 60 }] },
    ] };
    renderModal(logs);
    const historyBefore = localStorage.getItem('exerciseLogs');
    expect(screen.getByRole('spinbutton', { name: 'Set 1 reps' })).toHaveValue(9);
    expect(screen.getByLabelText('Historical best for set 1')).toHaveTextContent('Best: 12 reps · 60 kg');
    expect(screen.getByLabelText('Historical best for set 2')).toHaveTextContent('Best: 5 reps · 60 kg');
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '100' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '999' } });
    expect(screen.getByLabelText('Historical best for set 1')).toHaveTextContent('Best: 12 reps · 60 kg');
    expect(localStorage.getItem('exerciseLogs')).toBe(historyBefore);
  });

  test('keeps the historical best independent of edited or empty draft reps', () => {
    const logs = { bench: [{
      date: '2026-07-01T08:00:00.000Z',
      sets: [{ reps: 8, weight: 100 }],
    }] };
    renderModal(logs);
    const repsInput = screen.getByRole('spinbutton', { name: 'Set 1 reps' });

    expect(screen.getByText('Best: 8 reps · 100 kg')).toBeInTheDocument();
    fireEvent.change(repsInput, { target: { value: '9' } });
    expect(screen.getByText('Best: 8 reps · 100 kg')).toBeInTheDocument();
    fireEvent.change(repsInput, { target: { value: '' } });
    expect(screen.getByLabelText('Historical best for set 1')).toHaveTextContent('Best: 8 reps · 100 kg');
  });

  test('includes saved records while editing and preserves dropset parent numbering', () => {
    const logs = { bench: [
      {
        date: '2026-07-01T08:00:00.000Z',
        clientSessionId: 'older',
        sets: [{ reps: 8, weight: 100 }, { reps: 8, weight: 90 }],
        totalReps: 16,
        totalVolume: 1520,
      },
      {
        date: '2026-07-02T08:00:00.000Z',
        clientSessionId: 'editing',
        sets: [
          { reps: 8, weight: 120, setType: 'dropset' },
          { reps: 8, weight: 110, setType: 'dropset_child', dropSetChild: true },
          { reps: 8, weight: 105 },
        ],
        totalReps: 24,
        totalVolume: 2680,
      },
    ] };
    renderModal(logs, { initialTab: 'overview' });
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    fireEvent.click(screen.getAllByRole('button', { name: 'Edit' })[0]);

    expect(screen.getByText('Best: 8 reps · 120 kg')).toBeInTheDocument();
    expect(screen.getByText('Best: 8 reps · 105 kg')).toBeInTheDocument();
    expect(screen.getByText('1↓1')).toBeInTheDocument();
    expect(screen.queryByText('Best: 8 reps · 90 kg')).not.toBeInTheDocument();
    expect(screen.queryByText('Best: 8 reps · 110 kg')).not.toBeInTheDocument();
  });

  test('recomputes after history props change and after deleting the current best', () => {
    const best = {
      date: '2026-07-02T08:00:00.000Z',
      clientSessionId: 'best',
      sets: [{ reps: 8, weight: 105 }],
      totalReps: 8,
      totalVolume: 840,
    };
    const older = {
      date: '2026-07-01T08:00:00.000Z',
      clientSessionId: 'older',
      sets: [{ reps: 8, weight: 100 }],
      totalReps: 8,
      totalVolume: 800,
    };
    const view = renderModal({ bench: [older, best] });

    expect(screen.getByText('Best: 8 reps · 105 kg')).toBeInTheDocument();
    view.rerender(
      <ExerciseLogModal
        exercise={exercise}
        logs={{ bench: [older] }}
        onClose={jest.fn()}
        onSaved={jest.fn()}
        stayOpenOnSave
      />
    );
    expect(screen.getByText('Best: 8 reps · 100 kg')).toBeInTheDocument();

    localStorage.setItem('exerciseLogs', JSON.stringify({ bench: [older] }));
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete session' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back to Log' }));
    expect(screen.getByLabelText('Historical best for set 1')).toHaveTextContent('No saved best yet');
  });

  test('includes a newly persisted save without treating the unsaved draft as history', async () => {
    renderModal({ bench: [] });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 reps' }), { target: { value: '8' } });
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Set 1 weight' }), { target: { value: '105' } });

    expect(screen.getByLabelText('Historical best for set 1')).toHaveTextContent('No saved best yet');
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Done' })));
    expect(screen.getByText('Best: 8 reps · 105 kg')).toBeInTheDocument();
  });

  test('preserves unrelated Last Session and Same as last set copy', () => {
    const logs = { bench: [{
      date: '2026-07-01T08:00:00.000Z',
      sets: [{ reps: 8, weight: 100 }],
      totalReps: 8,
      totalVolume: 800,
    }] };
    renderModal(logs);

    expect(screen.getByRole('button', { name: 'Same as last set' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Overview' }));
    expect(screen.getByText('Last Session Sets')).toBeInTheDocument();
  });
});
