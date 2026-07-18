import {
  CLIENT_DIAGNOSTICS_STORAGE_KEY,
  createClientDiagnostics,
  installGlobalDiagnostics,
} from './clientDiagnostics';

describe('privacy-safe client diagnostics', () => {
  beforeEach(() => localStorage.clear());

  test('recovers from absent or malformed storage', () => {
    expect(createClientDiagnostics({ storage: localStorage }).getStored()).toEqual({
      errors: [],
      syncFailures: {},
    });

    localStorage.setItem(CLIENT_DIAGNOSTICS_STORAGE_KEY, '{broken');
    expect(createClientDiagnostics({ storage: localStorage }).getStored()).toEqual({
      errors: [],
      syncFailures: {},
    });
  });

  test('keeps only 20 sanitized fixed-shape errors without stacks or secret fields', () => {
    let tick = 0;
    const diagnostics = createClientDiagnostics({ storage: localStorage, now: () => ++tick });
    for (let index = 0; index < 22; index += 1) {
      const error = new Error(`failure ${index} for student@example.com token=super-secret access_token=raw-access api_key=raw-api Bearer abc.def.ghi eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.signaturevalue`);
      error.stack = `PRIVATE STACK ${index}`;
      error.password = 'student-password';
      diagnostics.recordError(error, { source: 'window', category: 'runtime' });
    }

    const stored = diagnostics.getStored();
    expect(stored.errors).toHaveLength(20);
    expect(stored.errors[0]).toEqual({
      source: 'window',
      category: 'runtime',
      message: expect.stringContaining('[REDACTED]'),
      occurredAt: 3,
    });
    const serialized = JSON.stringify(stored);
    expect(serialized).not.toContain('student@example.com');
    expect(serialized).not.toContain('super-secret');
    expect(serialized).not.toContain('raw-access');
    expect(serialized).not.toContain('raw-api');
    expect(serialized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(serialized).not.toContain('abc.def.ghi');
    expect(serialized).not.toContain('PRIVATE STACK');
    expect(serialized).not.toContain('student-password');
  });

  test('counts sync failures and produces a support snapshot without mutation payloads', () => {
    const diagnostics = createClientDiagnostics({
      storage: localStorage,
      now: () => 100,
      buildInfo: { displayId: 'abc12345' },
    });
    diagnostics.incrementSyncFailure('offline');
    diagnostics.incrementSyncFailure('server');
    diagnostics.incrementSyncFailure('server');

    expect(diagnostics.getSnapshot({
      status: 'error',
      pendingCount: 2,
      failedCount: 1,
      syncingCount: 0,
      lastSuccessfulSyncAt: '2026-07-15T20:00:00.000Z',
      operations: [{ payload: { privateWorkout: true } }],
    })).toEqual({
      buildId: 'abc12345',
      syncStatus: 'error',
      queueDepth: 3,
      lastSuccessfulSyncAt: '2026-07-15T20:00:00.000Z',
      syncFailures: { offline: 1, server: 2 },
      errors: [],
    });
  });

  test('installs removable window error and rejection handlers', () => {
    const diagnostics = createClientDiagnostics({ storage: localStorage, now: () => 200 });
    const fakeWindow = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };
    const cleanup = installGlobalDiagnostics(fakeWindow, diagnostics);
    const errorHandler = fakeWindow.addEventListener.mock.calls.find(([name]) => name === 'error')[1];
    const rejectionHandler = fakeWindow.addEventListener.mock.calls.find(([name]) => name === 'unhandledrejection')[1];

    errorHandler({ error: new Error('render failed') });
    rejectionHandler({ reason: new Error('request failed') });
    expect(diagnostics.getStored().errors.map((item) => item.category)).toEqual([
      'runtime',
      'unhandled-rejection',
    ]);

    cleanup();
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('error', errorHandler);
    expect(fakeWindow.removeEventListener).toHaveBeenCalledWith('unhandledrejection', rejectionHandler);
  });
});
