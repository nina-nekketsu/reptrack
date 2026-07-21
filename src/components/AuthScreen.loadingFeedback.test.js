import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import AuthScreen from './AuthScreen';

const mockSignInWithPassword = jest.fn();
const mockSignUp = jest.fn();
const mockResetPasswordForEmail = jest.fn();

jest.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args) => mockSignInWithPassword(...args),
      signUp: (...args) => mockSignUp(...args),
      resetPasswordForEmail: (...args) => mockResetPasswordForEmail(...args),
    },
  },
}));

function deferred() {
  let resolve;
  const promise = new Promise((next) => { resolve = next; });
  return { promise, resolve };
}

function fillCredentials() {
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'athlete@example.com' } });
  fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret1' } });
}

describe('AuthScreen loading feedback', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('exposes an immediate truthful busy state while sign-in is pending', async () => {
    const request = deferred();
    mockSignInWithPassword.mockReturnValue(request.promise);
    render(<AuthScreen />);
    fillCredentials();

    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    const submit = screen.getByRole('button', { name: 'Signing in…' });
    expect(submit).toBeDisabled();
    expect(submit).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Forgot password?' })).toBeDisabled();
    expect(mockSignInWithPassword).toHaveBeenCalledTimes(1);

    await act(async () => request.resolve({ error: null }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled());
  });

  test('labels only the pending password-reset action and preserves error copy', async () => {
    const request = deferred();
    mockResetPasswordForEmail.mockReturnValue(request.promise);
    render(<AuthScreen />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'athlete@example.com' } });

    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));

    const reset = screen.getByRole('button', { name: 'Sending reset…' });
    expect(reset).toBeDisabled();
    expect(reset).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();
    expect(mockResetPasswordForEmail).toHaveBeenCalledTimes(1);

    await act(async () => request.resolve({ error: new Error('Reset service unavailable') }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Reset service unavailable');
    expect(screen.getByRole('alert')).toHaveClass('error-feedback');
  });
});
