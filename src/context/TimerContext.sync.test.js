import React from 'react';
import { act, render } from '@testing-library/react';
import { TimerProvider, useTimer } from './TimerContext';

const mockUpsert = jest.fn(() => Promise.resolve({ error: null }));
jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'test-user' } } }) },
    from: () => ({ upsert: (...args) => mockUpsert(...args) }),
  },
}));

let timer;
function Probe() {
  timer = useTimer();
  return <div>{timer.phase}</div>;
}

describe('remote timer synchronization', () => {
  beforeEach(() => {
    mockUpsert.mockClear();
    mockUpsert.mockImplementation(() => Promise.resolve({ error: null }));
    localStorage.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-26T12:00:00Z'));
  });

  afterEach(() => jest.useRealTimers());

  test('syncs a new deadline when another completed set restarts an active rest', async () => {
    render(<TimerProvider><Probe /></TimerProvider>);
    act(() => { timer.setExerciseId('bench'); });
    expect(mockUpsert).not.toHaveBeenCalled();
    await act(async () => { timer.startRest(90000); });
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    const firstDeadline = mockUpsert.mock.calls[0][0].state.restEndAt;

    act(() => jest.advanceTimersByTime(10000));
    expect(mockUpsert).toHaveBeenCalledTimes(1);
    await act(async () => { timer.startRest(90000); });
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpsert.mock.calls[1][0].state.restEndAt).toBe(firstDeadline + 10000);
  });
});
