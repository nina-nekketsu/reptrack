import { fireEvent, render, screen } from '@testing-library/react';
import DiagnosticsPanel from './DiagnosticsPanel';

const mockGetSyncSnapshot = jest.fn();
const mockGetDiagnosticsSnapshot = jest.fn();

jest.mock('../lib/sync', () => ({
  getSyncSnapshot: () => mockGetSyncSnapshot(),
}));

jest.mock('../lib/clientDiagnosticsRuntime', () => ({
  clientDiagnostics: {
    getSnapshot: (...args) => mockGetDiagnosticsSnapshot(...args),
  },
}));

const snapshot = {
  buildId: 'abc123',
  queueDepth: 2,
  lastSuccessfulSyncAt: '2026-07-15T20:00:00.000Z',
  syncFailures: { offline: 1, server: 2 },
  errors: [
    {
      id: 'error-1',
      source: 'runtime',
      category: 'runtime',
      message: 'token=[REDACTED]',
      occurredAt: '2026-07-15T20:01:00.000Z',
    },
  ],
};

describe('DiagnosticsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSyncSnapshot.mockReturnValue({
      operations: [{ payload: { privateWorkout: 'must-not-render' } }],
      pendingCount: 1,
      failedCount: 1,
      syncingCount: 0,
      lastSuccessfulSyncAt: snapshot.lastSuccessfulSyncAt,
    });
    mockGetDiagnosticsSnapshot.mockReturnValue(snapshot);
  });

  test('renders privacy-safe support data and no mutation payloads', () => {
    render(<DiagnosticsPanel />);

    expect(screen.getByText('Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('abc123')).toBeInTheDocument();
    expect(screen.getByText('2 queued')).toBeInTheDocument();
    expect(screen.getByText('3 sync failures')).toBeInTheDocument();
    expect(screen.getByText('token=[REDACTED]')).toBeInTheDocument();
    expect(screen.queryByText(/must-not-render/)).not.toBeInTheDocument();
  });

  test('refreshes from current sync and diagnostics state', () => {
    render(<DiagnosticsPanel />);
    const refreshed = { ...snapshot, queueDepth: 0, errors: [] };
    mockGetDiagnosticsSnapshot.mockReturnValue(refreshed);

    fireEvent.click(screen.getByRole('button', { name: 'Refresh diagnostics' }));

    expect(screen.getByText('0 queued')).toBeInTheDocument();
    expect(mockGetDiagnosticsSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({ pendingCount: 1, failedCount: 1 })
    );
  });

  test('renders the canonical diagnostics snapshot contract', () => {
    mockGetDiagnosticsSnapshot.mockReturnValue({
      buildId: 'canonical-1',
      syncStatus: 'error',
      queueDepth: 1,
      lastSuccessfulSyncAt: null,
      syncFailures: { server: 2 },
      errors: [{
        source: 'window',
        category: 'runtime',
        message: 'request failed',
        occurredAt: 100,
      }],
    });

    render(<DiagnosticsPanel />);

    expect(screen.getByText('canonical-1')).toBeInTheDocument();
    expect(screen.getByText('2 sync failures')).toBeInTheDocument();
    expect(screen.getByText('request failed')).toBeInTheDocument();
    expect(screen.getByText('request failed').nextElementSibling).toHaveAttribute(
      'datetime',
      new Date(100).toISOString()
    );
  });
});
