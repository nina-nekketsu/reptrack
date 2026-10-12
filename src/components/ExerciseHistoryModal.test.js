import React, { useState } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ExerciseHistoryModal from './ExerciseHistoryModal';
import { loadLogs } from '../utils/exerciseHelpers';

const mockVolumeGraph = jest.fn(() => <div data-testid="mock-history-volume-graph">Graph</div>);

jest.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: null }) }));
jest.mock('./RecordBadges', () => () => <div>Records</div>);
jest.mock('./VolumeGraph', () => (props) => mockVolumeGraph(props));

const exercise = { id: 'bench', name: 'Bench Press', muscleGroup: 'Chest' };

function renderHistory(logs) {
  return render(
    <ExerciseHistoryModal
      exercise={exercise}
      logs={logs}
      onClose={() => {}}
      onOpenLog={() => {}}
      onLogsChanged={() => {}}
    />
  );
}

function HistoryHarness({ logs }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open Bench Press history</button>
      {open && (
        <ExerciseHistoryModal
          exercise={exercise}
          logs={logs}
          onClose={() => setOpen(false)}
          onOpenLog={() => {}}
          onLogsChanged={() => {}}
        />
      )}
    </>
  );
}

const historyLogs = {
  bench: [{
    id: 'session-1',
    date: '2026-07-20T09:30:00.000Z',
    sets: [{ weight: 70, reps: 5 }],
    totalReps: 5,
    totalVolume: 350,
    bestSet: { weight: 70, reps: 5 },
  }],
};

describe('ExerciseHistoryModal dialog behavior', () => {
  test('is modal, closes on Escape, and returns focus to its trigger', () => {
    render(<HistoryHarness logs={historyLogs} />);
    const trigger = screen.getByRole('button', { name: 'Open Bench Press history' });

    userEvent.click(trigger);
    expect(screen.getByRole('dialog', { name: 'Bench Press' })).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: /log/i })).toHaveFocus();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Bench Press' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  test('keeps history open when Escape cancels delete confirmation and returns focus to delete', () => {
    render(<HistoryHarness logs={historyLogs} />);
    userEvent.click(screen.getByRole('button', { name: 'Open Bench Press history' }));
    const deleteTrigger = screen.getByRole('button', { name: 'Delete session' });

    userEvent.click(deleteTrigger);
    expect(screen.getByRole('dialog', { name: 'Delete session?' })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Delete session?' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Bench Press' })).toBeInTheDocument();
    expect(deleteTrigger).toHaveFocus();
  });
});

describe('ExerciseHistoryModal progress graph integration', () => {
  beforeEach(() => {
    localStorage.clear();
    mockVolumeGraph.mockClear();
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true });
    loadLogs();
  });

  test('passes exercise identity and truthful loading/offline states to the graph', () => {
    const { rerender } = renderHistory(undefined);
    expect(mockVolumeGraph).toHaveBeenCalled();
    expect(mockVolumeGraph).toHaveBeenLastCalledWith(expect.objectContaining({
      exerciseId: 'bench',
      sessions: [],
      loading: true,
      offline: false,
      error: null,
    }));

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
    act(() => window.dispatchEvent(new Event('offline')));
    rerender(
      <ExerciseHistoryModal exercise={exercise} logs={{ bench: [] }} onClose={() => {}} onOpenLog={() => {}} onLogsChanged={() => {}} />
    );
    expect(mockVolumeGraph).toHaveBeenLastCalledWith(expect.objectContaining({
      exerciseId: 'bench',
      loading: false,
      offline: true,
      error: null,
    }));
  });

  test('surfaces a real persisted-history parse failure as a graph error', () => {
    localStorage.setItem('exerciseLogs', '{broken json');
    const logs = loadLogs();
    renderHistory(logs);
    expect(mockVolumeGraph).toHaveBeenLastCalledWith(expect.objectContaining({
      loading: false,
      error: 'invalid-history',
    }));
  });
});
