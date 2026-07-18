// src/components/SetupScreen.js
// Shown when REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY are not set.
// Lets the user continue locally (no sync) or see setup instructions.

import React, { useState } from 'react';
import { DumbbellIcon } from './icons';

export default function SetupScreen({ onSkip }) {
  const [showInstructions, setShowInstructions] = useState(false);

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-logo" aria-hidden="true"><DumbbellIcon /></div>
        <h1 className="auth-title">RepTrack</h1>
        <p className="auth-subtitle">Cloud sync is not configured</p>

        {!showInstructions ? (
          <>
            <p className="setup-info">
              The app works fully offline. To enable cross-device sync via Supabase,
              add your credentials to <code>.env</code>.
            </p>
            <button className="auth-submit" onClick={() => setShowInstructions(true)}>
              How to set up sync
            </button>
            <button className="auth-toggle" onClick={onSkip}>
              Continue without sync →
            </button>
          </>
        ) : (
          <>
            <div className="setup-steps">
              <p><strong>1.</strong> Create a free project at <a href="https://supabase.com" target="_blank" rel="noreferrer">supabase.com</a></p>
              <p><strong>2.</strong> For a new project, review and run <code>supabase/schema_current.sql</code>. For an existing project, use a reviewed additive migration instead.</p>
              <p><strong>3.</strong> Create <code>.env</code> in the project root:</p>
              <pre className="setup-code">{`REACT_APP_SUPABASE_URL=https://xxxx.supabase.co\nREACT_APP_SUPABASE_ANON_KEY=eyJ...`}</pre>
              <p><strong>4.</strong> Restart with <code>npm start</code></p>
              <p><strong>5.</strong> For GitHub Pages deploy, add these as repository secrets / Actions env vars and rebuild.</p>
            </div>
            <button className="auth-toggle" onClick={onSkip}>
              Continue without sync →
            </button>
            <button className="auth-toggle auth-toggle--stacked" onClick={() => setShowInstructions(false)}>
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}
