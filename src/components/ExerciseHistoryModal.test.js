import React from 'react';
import { act, render } from '@testing-library/react';
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
