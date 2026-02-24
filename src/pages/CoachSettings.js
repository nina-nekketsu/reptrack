// src/pages/CoachSettings.js — Coach configuration page
import React, { useState } from 'react';
import { useCoach } from '../context/CoachContext';
import trainingPlans, { getPlanById } from '../data/trainingPlans';
import './CoachSettings.css';

export default function CoachSettings() {
  const {
    profile, metadata, updateProfile, updateMetadata,
    weeklyCardioMinutes, cardioTarget, addCardioLog,
    weeksActive, targetRIR, resetCoach,
  } = useCoach();

  const [cardioType, setCardioType] = useState('run');
  const [cardioMinutes, setCardioMinutes] = useState('');
  const [showReset, setShowReset] = useState(false);

  const plan = profile.planId ? getPlanById(profile.planId) : null;

  function handleCardioLog() {
    const mins = Number(cardioMinutes);
    if (!mins || mins <= 0) return;
    addCardioLog({ type: cardioType, minutes: mins });
    setCardioMinutes('');
  }

  const cardioPercent = Math.min(100, Math.round((weeklyCardioMinutes / cardioTarget) * 100));

  return (
    <div className="page coach-settings-page">
      <h1 className="page-heading cs-heading">Coach Settings</h1>

      {/* Current Plan */}
      <div className="card cs-card">
        <div className="card-label">Current Plan</div>
        <div className="card-value">{plan ? plan.name : 'None selected'}</div>
        {plan && (
          <div className="cs-plan-meta">
            {plan.daysPerWeek}x/week · {plan.durationMin}min · {plan.goal} · Week {weeksActive}
          </div>
        )}
        <div className="cs-plan-meta">Target RIR this week: {targetRIR}</div>

        {/* Plan switcher */}
        <div className="cs-section-label">Switch Plan</div>
        <div className="cs-plan-list">
          {trainingPlans.map(p => (
            <button
              key={p.id}
              className={`cs-plan-option ${profile.planId === p.id ? 'cs-plan-option--active' : ''}`}
              onClick={() => updateProfile({ planId: p.id })}
            >
              <span className="cs-plan-option-name">{p.name}</span>
              <span className="cs-plan-option-meta">
                {p.daysPerWeek}d · {p.durationMin}m · {p.goal}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Encouragement Style */}
      <div className="card cs-card">
        <div className="card-label">Encouragement Style</div>
        <div className="cs-style-row">
          {['soft', 'balanced', 'tough', 'aggressive'].map(style => (
            <button
              key={style}
              className={`cs-style-btn ${profile.encouragementStyle === style ? 'cs-style-btn--active' : ''}`}
              onClick={() => updateProfile({ encouragementStyle: style })}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Feedback Frequency */}
      <div className="card cs-card">
        <div className="card-label">Feedback Frequency</div>
        <div className="cs-style-row">
          {['minimal', 'normal', 'detailed'].map(freq => (
            <button
              key={freq}
              className={`cs-style-btn ${profile.feedbackFrequency === freq ? 'cs-style-btn--active' : ''}`}
              onClick={() => updateProfile({ feedbackFrequency: freq })}
            >
              {freq}
            </button>
          ))}
        </div>
      </div>

      {/* Progression Mode */}
      <div className="card cs-card">
        <div className="card-label">Progression Mode</div>
        <div className="cs-style-row">
          {['conservative', 'moderate'].map(mode => (
            <button
              key={mode}
              className={`cs-style-btn ${profile.progression === mode ? 'cs-style-btn--active' : ''}`}
              onClick={() => updateProfile({ progression: mode })}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* All-Out Toggle */}
      <div className="card cs-card">
        <div className="cs-toggle-row">
          <div>
            <div className="card-label">Allow All-Out Sets</div>
            <div className="cs-plan-meta">
              {weeksActive < 4
                ? `Available after 4 weeks (week ${weeksActive} of 4)`
                : 'You have enough training experience'}
            </div>
          </div>
          <button
            className={`timer-toggle ${metadata.allOutAllowed ? 'timer-toggle--on' : ''}`}
            onClick={() => updateMetadata({ allOutAllowed: !metadata.allOutAllowed })}
            disabled={weeksActive < 4}
          >
            <span className="timer-toggle-knob" />
          </button>
        </div>
      </div>

      {/* Cardio Tracking */}
      <div className="card cs-card">
        <div className="card-label">Weekly Cardio</div>
        <div className="cardio-section">
          <div className="cardio-progress">
            <div className="cardio-progress-fill" style={{ width: `${cardioPercent}%` }} />
          </div>
          <div className="cardio-status">
            {Math.round(weeklyCardioMinutes)} / {cardioTarget} min this week ({cardioPercent}%)
          </div>
          <div className="cardio-log-form">
            <select value={cardioType} onChange={e => setCardioType(e.target.value)}>
              <option value="run">Running</option>
              <option value="bike">Cycling</option>
              <option value="swim">Swimming</option>
              <option value="walk">Walking (half credit)</option>
              <option value="other">Other</option>
            </select>
            <input
              type="number"
              placeholder="min"
              value={cardioMinutes}
              onChange={e => setCardioMinutes(e.target.value)}
              min="1"
            />
            <button className="cardio-log-btn" onClick={handleCardioLog}>Log</button>
          </div>
        </div>
      </div>

      {/* Coaching Metadata */}
      <div className="card cs-card">
        <div className="card-label">Coaching Intelligence</div>
        <div className="cs-meta-grid">
          <div className="cs-meta-item">
            <span className="cs-meta-label">Fatigue Score</span>
            <span className="cs-meta-value">{metadata.fatigueScore}/100</span>
          </div>
          <div className="cs-meta-item">
            <span className="cs-meta-label">Sessions</span>
            <span className="cs-meta-value">{metadata.totalSessions}</span>
          </div>
          <div className="cs-meta-item">
            <span className="cs-meta-label">Weeks Active</span>
            <span className="cs-meta-value">{weeksActive}</span>
          </div>
        </div>

        {Object.keys(metadata.plateauRisk).length > 0 && (
          <>
            <div className="cs-section-label" style={{ marginTop: '0.75rem' }}>Plateau Risk</div>
            {Object.entries(metadata.plateauRisk).map(([id, risk]) => (
              <div key={id} className="cs-meta-item">
                <span className="cs-meta-label">{id}</span>
                <span className="cs-meta-value" style={{ color: risk > 50 ? 'var(--c-danger)' : 'inherit' }}>
                  {risk}%
                </span>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Reset */}
      <div className="card cs-card">
        {!showReset ? (
          <button className="cs-reset-btn" onClick={() => setShowReset(true)}>
            Reset Coach Data
          </button>
        ) : (
          <div className="cs-reset-confirm">
            <p>This will delete all coaching data. Are you sure?</p>
            <div className="cs-reset-actions">
              <button className="btn-danger" onClick={() => { resetCoach(); setShowReset(false); }}>
                Yes, Reset
              </button>
              <button className="btn-secondary" onClick={() => setShowReset(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
