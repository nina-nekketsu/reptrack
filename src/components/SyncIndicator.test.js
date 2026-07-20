import React from 'react';
import fs from 'fs';
import path from 'path';
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

function readSyncIndicatorCss() {
  return fs.readFileSync(path.join(process.cwd(), 'src/components/SyncIndicator.css'), 'utf8');
}

function declarationsFor(source, selector) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`, 's'));
  return match?.[1].replace(/\s+/g, ' ').replace(/:\s*/g, ': ').trim() || '';
}

function blockFor(source, marker) {
  const markerIndex = source.indexOf(marker);
  if (markerIndex === -1) return '';

  const openIndex = source.indexOf('{', markerIndex + marker.length);
  let depth = 1;
  let cursor = openIndex + 1;

  while (cursor < source.length && depth > 0) {
    if (source[cursor] === '{') depth += 1;
    if (source[cursor] === '}') depth -= 1;
    cursor += 1;
  }

  return source.slice(openIndex + 1, cursor - 1);
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

  test('cues only authoritative state changes while keeping the live region stable', () => {
    mockSnapshot = {
      ...mockSnapshot,
      pendingCount: 1,
      operations: [{ id: 'pending-1', status: 'pending' }],
    };
    const { rerender } = render(<SyncIndicator />);
    const liveRegion = screen.getByRole('status', { name: '1 change pending' });
    const initialIcon = liveRegion.querySelector('.sync-indicator__icon');

    expect(initialIcon).not.toHaveClass('sync-indicator__icon--state-change');

    rerender(<SyncIndicator />);
    expect(screen.getByRole('status', { name: '1 change pending' })).toBe(liveRegion);
    expect(liveRegion.querySelector('.sync-indicator__icon')).toBe(initialIcon);

    act(() => {
      snapshotListener({
        ...mockSnapshot,
        pendingCount: 0,
        syncingCount: 1,
        operations: [{ id: 'pending-1', status: 'syncing' }],
      });
    });

    expect(screen.getByRole('status', { name: 'Syncing changes' })).toBe(liveRegion);
    expect(liveRegion.querySelector('.sync-indicator__icon')).not.toBe(initialIcon);
    expect(liveRegion.querySelector('.sync-indicator__icon'))
      .toHaveClass('sync-indicator__icon--state-change');
  });

  test('invokes each failed retry once and exposes busy feedback without delaying the flush', async () => {
    mockSnapshot = {
      ...mockSnapshot,
      failedCount: 1,
      operations: [{ id: 'failed-1', status: 'failed' }],
    };
    let resolveFlush;
    mockFlushPendingMutations.mockReturnValue(new Promise((resolve) => { resolveFlush = resolve; }));
    render(<SyncIndicator />);
    mockFlushPendingMutations.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Retry failed sync' }));

    const retry = screen.getByRole('button', { name: 'Retrying failed sync' });
    expect(retry).toBeDisabled();
    expect(retry).toHaveAttribute('aria-busy', 'true');
    expect(retry).toHaveTextContent('Retrying…');
    expect(mockRetryPendingMutation).toHaveBeenCalledTimes(1);
    expect(mockRetryPendingMutation).toHaveBeenCalledWith('failed-1');
    expect(mockFlushPendingMutations).toHaveBeenCalledTimes(1);

    fireEvent.click(retry);
    expect(mockRetryPendingMutation).toHaveBeenCalledTimes(1);
    expect(mockFlushPendingMutations).toHaveBeenCalledTimes(1);

    await act(async () => resolveFlush({ processed: 1, succeeded: 0, failed: 1, pending: 0 }));
    expect(screen.getByRole('button', { name: 'Retry failed sync' })).toBeEnabled();
  });
});

describe('P2.3 SyncIndicator motion CSS contract', () => {
  test('uses bounded composited state feedback and fast color transitions', () => {
    const css = readSyncIndicatorCss();
    const indicatorRule = declarationsFor(css, '.sync-indicator.sync-indicator--truthful');
    const cueRule = declarationsFor(css, '.sync-indicator__icon--state-change');
    const cueKeyframes = blockFor(css, '@keyframes sync-indicator-state-change');

    expect(indicatorRule).toContain('color var(--motion-duration-fast) var(--motion-ease-standard)');
    expect(indicatorRule).toContain('background-color var(--motion-duration-fast) var(--motion-ease-standard)');
    expect(indicatorRule).toContain('border-color var(--motion-duration-fast) var(--motion-ease-standard)');
    expect(cueRule).toContain('animation: sync-indicator-state-change var(--motion-duration-control) var(--motion-ease-enter) 1 both');
    expect(cueKeyframes).toMatch(/opacity:/);
    expect(cueKeyframes).toMatch(/transform:\s*scale/);
    expect(cueKeyframes).not.toMatch(/rotate|width|height|margin|padding|top|right|bottom|left/);
    expect(css).not.toMatch(/animation(?:-[\w-]+)?\s*:[^;{}]*\binfinite\b|transition\s*:\s*all/i);
  });

  test('makes reduced-motion state changes immediate and static', () => {
    const css = readSyncIndicatorCss();
    const reducedCss = blockFor(css, '@media (prefers-reduced-motion: reduce)');
    const reducedIndicatorRule = declarationsFor(
      reducedCss,
      '.sync-indicator.sync-indicator--truthful'
    );
    const reducedCueRule = declarationsFor(reducedCss, '.sync-indicator__icon--state-change');

    expect(reducedIndicatorRule).toContain('transition: none');
    expect(reducedCueRule).toContain('animation: none');
    expect(reducedCueRule).toContain('opacity: 1');
    expect(reducedCueRule).toContain('transform: none');
  });
});
