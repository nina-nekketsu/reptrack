import { act, render, screen } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';

const mockGetSession = jest.fn();
let mockAuthListener;
const mockUnsubscribe = jest.fn();

jest.mock('../lib/supabase', () => ({
  isConfigured: true,
  supabase: {
    auth: {
      getSession: () => mockGetSession(),
      onAuthStateChange: (listener) => {
        mockAuthListener = listener;
        return { data: { subscription: { unsubscribe: mockUnsubscribe } } };
      },
    },
  },
}));
jest.mock('../lib/sync', () => ({
  pullAll: jest.fn().mockResolvedValue(undefined),
  pushAll: jest.fn().mockResolvedValue(undefined),
  getSyncStatus: () => 'idle',
  onSyncStatusChange: () => () => {},
}));

function Probe() {
  const { user, loading } = useAuth();
  return <div role="status">{loading ? 'loading' : user?.id || 'signed out'}</div>;
}

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

beforeEach(() => jest.clearAllMocks());

test.each([
  [null, 'signed out'],
  [{ user: { id: 'stored-user' } }, 'stored-user'],
])('initial session %j resolves startup normally', async (session, expected) => {
  mockGetSession.mockResolvedValue({ data: { session } });
  render(<AuthProvider><Probe /></AuthProvider>);
  await act(async () => {});
  expect(screen.getByRole('status')).toHaveTextContent(expected);
});

test('a stale initial snapshot cannot restore a session after sign-out', async () => {
  const initial = deferred();
  mockGetSession.mockReturnValue(initial.promise);
  render(<AuthProvider><Probe /></AuthProvider>);
  await act(async () => mockAuthListener('SIGNED_OUT', null));
  await act(async () => initial.resolve({ data: { session: { user: { id: 'old-user' } } } }));
  expect(screen.getByRole('status')).toHaveTextContent('signed out');
});

test('a confirmed sign-in releases startup even while the initial session read is pending', async () => {
  const initial = deferred();
  mockGetSession.mockReturnValue(initial.promise);
  render(<AuthProvider><Probe /></AuthProvider>);
  expect(screen.getByRole('status')).toHaveTextContent('loading');

  await act(async () => mockAuthListener('SIGNED_IN', { user: { id: 'test-user' } }));

  expect(screen.getByRole('status')).toHaveTextContent('test-user');
});

test('a stale initial snapshot cannot replace a newer confirmed sign-in', async () => {
  const initial = deferred();
  mockGetSession.mockReturnValue(initial.promise);
  render(<AuthProvider><Probe /></AuthProvider>);
  await act(async () => mockAuthListener('SIGNED_IN', { user: { id: 'test-user' } }));

  await act(async () => initial.resolve({ data: { session: null } }));

  expect(screen.getByRole('status')).toHaveTextContent('test-user');
});
