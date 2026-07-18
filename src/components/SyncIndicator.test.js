import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SyncIndicator from './SyncIndicator';

let mockAuth;
let mockSnapshot;
let snapshotListener;
const mockFlushPendingMutations = jest.fn();
const mockRetryPendingMutation = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('../lib/sync', () => ({
  getSyncStatus: () => mockSnapshot.status,
  onSyncStatusChange: () => () => {},
  getSyncSnapshot: () => mockSnapshot,
  onSyncSnapshotChange: (listener) => {
    snapshotListener = listener;
    return () => { snapshotListener = null; };
  },
  flushPendingMutations: (...args) => mockFlushPendingMutations(...args),
  retryPendingMutation: (...args) => mockRetryPendingMutation(...args),
}));

function setOnline(value) {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    value,
  });
}

describe('SyncIndicator truthful states', () => {
  beforeEach(() => {
    mockAuth = { user: { id: 'user-1' }, isConfigured: true };
    mockSnapshot = {
      status: 'idle',
      pendingCount: 0,
      failedCount: 0,
      syncingCount: 0,
      lastSuccessfulSyncAt: null,
      operations: [],
    };
    snapshotListener = null;
    mockFlushPendingMutations.mockReset().mockResolvedValue({
      processed: 0,
      succeeded: 0,
      failed: 0,
      pending: 0,
    });
    mockRetryPendingMutation.mockReset();
    setOnline(true);
  });

  test('stays hidden when cloud sync is unavailable', () => {
    mockAuth.isConfigured = false;
    render(<SyncIndicator />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  test('does not claim synced before a successful sync is known', () => {
    render(<SyncIndicator />);
    expect(screen.getByRole('status', { name: 'Not synced yet' })).toBeInTheDocument();
  });

  test('shows queued, syncing, and synced states from live snapshots', async () => {
    mockSnapshot = { ...mockSnapshot, pendingCount: 1, operations: [{ id: 'one', status: 'pending' }] };
    render(<SyncIndicator />);
    expect(screen.getByRole('status', { name: '1 change pending' })).toBeInTheDocument();

    act(() => {
      snapshotListener({ ...mockSnapshot, pendingCount: 0, syncingCount: 1, operations: [] });
    });
    expect(screen.getByRole('status', { name: 'Syncing changes' })).toBeInTheDocument();

    act(() => {
      snapshotListener({
        ...mockSnapshot,
        pendingCount: 0,
        syncingCount: 0,
        lastSuccessfulSyncAt: '2026-07-15T20:00:00.000Z',
        operations: [],
      });
    });
    expect(screen.getByRole('status', { name: 'Synced' })).toBeInTheDocument();
    await waitFor(() => expect(mockFlushPendingMutations).toHaveBeenCalled());
  });

  test('shows offline before all transport states', () => {
    setOnline(false);
    mockSnapshot = { ...mockSnapshot, failedCount: 1, operations: [{ id: 'failed-1', status: 'failed' }] };
    render(<SyncIndicator />);
    expect(screen.getByRole('status', { name: 'Offline — 1 change not synced' })).toBeInTheDocument();
  });

  test('shows failed work and retries it only after an explicit action', async () => {
    mockSnapshot = {
      ...mockSnapshot,
      failedCount: 1,
      operations: [{ id: 'failed-1', status: 'failed' }],
    };
    render(<SyncIndicator />);

    expect(screen.getByRole('alert', { name: '1 change failed to sync' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry failed sync' }));

    expect(mockRetryPendingMutation).toHaveBeenCalledWith('failed-1');
    await waitFor(() => expect(mockFlushPendingMutations).toHaveBeenCalled());
  });

  test('replays queued work when connectivity returns', async () => {
    setOnline(false);
    render(<SyncIndicator />);
    mockFlushPendingMutations.mockClear();

    setOnline(true);
    act(() => window.dispatchEvent(new Event('online')));

    await waitFor(() => expect(mockFlushPendingMutations).toHaveBeenCalledTimes(1));
  });

  test('retries only network-class failed work when connectivity returns', async () => {
    setOnline(false);
    mockSnapshot = {
      ...mockSnapshot,
      failedCount: 2,
      operations: [
        {
          id: 'network-failure',
          status: 'failed',
          lastError: { code: 'UNKNOWN', message: 'TypeError: Failed to fetch' },
        },
        {
          id: 'server-failure',
          status: 'failed',
          lastError: { code: 'PGRST500', message: 'Database error' },
        },
      ],
    };
    render(<SyncIndicator />);
    mockFlushPendingMutations.mockClear();

    setOnline(true);
    act(() => window.dispatchEvent(new Event('online')));

    await waitFor(() => expect(mockRetryPendingMutation).toHaveBeenCalledWith('network-failure'));
    expect(mockRetryPendingMutation).not.toHaveBeenCalledWith('server-failure');
    await waitFor(() => expect(mockFlushPendingMutations).toHaveBeenCalledTimes(1));
  });
});
