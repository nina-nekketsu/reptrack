// src/components/AuthScreen.js
// Shown when: Supabase is configured but user is not logged in.

import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function AuthScreen() {
  const [mode, setMode]       = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]     = useState(null);
  const [info, setInfo]       = useState(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

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
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    setError(null);
    setInfo(null);

    if (!email || !email.includes('@')) {
      setError('Enter your email first, then tap Forgot password.');
      return;
    }

    setLoading(true);
    try {
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error: err } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (err) throw err;
      setInfo('Password reset email sent. Check your inbox and spam folder.');
    } catch (err) {
      setError(err.message || 'Could not send reset email.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo">💪</div>
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

          {error && <div className="auth-error">{error}</div>}
          {info  && <div className="auth-info">{info}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading
              ? 'Please wait…'
              : mode === 'signin' ? 'Sign In' : 'Create Account'}
          </button>

          {mode === 'signin' && (
            <button
              type="button"
              className="auth-toggle"
              onClick={handleForgotPassword}
              disabled={loading}
            >
              Forgot password?
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
