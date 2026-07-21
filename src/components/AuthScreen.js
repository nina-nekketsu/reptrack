// src/components/AuthScreen.js
// Shown when: Supabase is configured but user is not logged in.

import React, { useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { DumbbellIcon } from './icons';

export default function AuthScreen() {
  const [mode, setMode]       = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState(null);
  const [info, setInfo]       = useState(null);
  const [pendingAction, setPendingAction] = useState(null);
  const pendingActionRef = useRef(null);
  const loading = pendingAction !== null;

  function beginPendingAction(action) {
    if (pendingActionRef.current) return false;
    pendingActionRef.current = action;
    setPendingAction(action);
    return true;
  }

  function endPendingAction() {
    pendingActionRef.current = null;
    setPendingAction(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const action = mode === 'signup' ? 'signup' : 'signin';
    if (!beginPendingAction(action)) return;
    setError(null);
    setInfo(null);

    try {
      if (mode === 'signup') {
        const { error: err } = await supabase.auth.signUp({ email, password });
        if (err) throw err;
        setInfo('Check your email for a confirmation link.');
      } else {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        // AuthContext listener handles the rest
      }
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      endPendingAction();
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setInfo(null);

    if (!email || !email.includes('@')) {
      setError('Enter your email first, then tap Forgot password.');
      return;
    }

    if (!beginPendingAction('reset')) return;
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (err) throw err;
      setInfo('Password reset email sent. Check your inbox and spam folder.');
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      endPendingAction();
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true"><DumbbellIcon /></div>
        <h1 className="auth-title">RepTrack</h1>
        <p className="auth-subtitle">
          {mode === 'signin' ? 'Sign in to sync your training data' : 'Create an account'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              className="auth-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="auth-field">
            <label className="auth-label" htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              className="auth-input"
              type="password"
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {error && <div className="auth-error error-feedback" role="alert">{error}</div>}
          {info  && <div className="auth-info">{info}</div>}

          <button
            className="auth-submit"
            type="submit"
            disabled={loading}
            aria-busy={pendingAction === 'signin' || pendingAction === 'signup'}
          >
            {pendingAction === 'signin'
              ? 'Signing in…'
              : pendingAction === 'signup'
                ? 'Creating account…'
                : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          {mode === 'signin' && (
            <button
              type="button"
              className="auth-toggle"
              onClick={handleForgotPassword}
              disabled={loading}
              aria-busy={pendingAction === 'reset'}
            >
              {pendingAction === 'reset' ? 'Sending reset…' : 'Forgot password?'}
            </button>
          )}
        </form>

        <button
          className="auth-toggle"
          onClick={() => { setMode(m => m === 'signin' ? 'signup' : 'signin'); setError(null); setInfo(null); }}
        >
          {mode === 'signin'
            ? "Don't have an account? Sign up"
            : 'Already have an account? Sign in'}
        </button>
      </div>
    </div>
  );
}
