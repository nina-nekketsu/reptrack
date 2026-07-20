import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import Profile from './Profile';

let mockAuth;
const mockGetCoachShare = jest.fn();
const mockEnableCoachShare = jest.fn();
const mockDisableCoachShare = jest.fn();
const mockRotateCoachToken = jest.fn();

jest.mock('../context/AuthContext', () => ({
  useAuth: () => mockAuth,
}));

jest.mock('../lib/supabase', () => ({ isConfigured: true }));

jest.mock('../lib/coachShare', () => ({
  getCoachShare: (...args) => mockGetCoachShare(...args),
  enableCoachShare: (...args) => mockEnableCoachShare(...args),
  disableCoachShare: (...args) => mockDisableCoachShare(...args),
  rotateCoachToken: (...args) => mockRotateCoachToken(...args),
}));

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

describe('Profile busy feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockAuth = {
      user: { id: 'user-1', email: 'athlete@example.com' },
      signOut: jest.fn(),
      syncing: false,
      syncError: null,
      syncData: jest.fn(),
    };
    mockGetCoachShare.mockResolvedValue({ enabled: false, token: 'coach-token' });
  });

  test('shows the authoritative sync busy state', async () => {
    mockAuth.syncing = true;
    render(<Profile />);
    await screen.findByText('Sharing OFF');

    const sync = screen.getByRole('button', { name: 'Syncing…' });
    expect(sync).toBeDisabled();
    expect(sync).toHaveAttribute('aria-busy', 'true');
  });

  test('uses a stable explicit saving label while coach sharing is pending', async () => {
    const request = deferred();
    mockEnableCoachShare.mockReturnValue(request.promise);
    render(<Profile />);
    await screen.findByText('Sharing OFF');

    fireEvent.click(screen.getByRole('button', { name: 'OFF' }));

    const toggle = screen.getByRole('button', { name: 'Saving…' });
    expect(toggle).toBeDisabled();
    expect(toggle).toHaveAttribute('aria-busy', 'true');
    expect(mockEnableCoachShare).toHaveBeenCalledTimes(1);

    await act(async () => request.resolve({ enabled: true, token: 'coach-token' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'ON' })).toBeEnabled());
  });
});
