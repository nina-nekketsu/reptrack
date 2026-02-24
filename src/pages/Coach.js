// src/pages/Coach.js — Main Coach dashboard (entry point for Coach tab)
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoach } from '../context/CoachContext';
import { getPlanById } from '../data/trainingPlans';
import CoachOnboarding from './CoachOnboarding';
import './Coach.css';

export default function Coach() {
  const navigate = useNavigate();
  const {
    isOnboarded, profile, metadata,
    weeksActive, targetRIR,
    weeklyCardioMinutes, cardioTarget,
  } = useCoach();

  // Gate: if not onboarded, show onboarding flow
  if (!isOnboarded) {
    return <CoachOnboarding onComplete={() => {}} />;
  }

  const plan = profile.planId ? getPlanById(profile.planId) : null;
  const cardioPercent = Math.min(100, Math.round((weeklyCardioMinutes / cardioTarget) * 100));

  return (
    <div className="page coach-page">
      <h1 className="page-heading coach-heading">AI Coach</h1>
      <p className="page-sub coach-sub">Harder Than Last Time</p>

      {/* Current plan overview */}
      {plan && (
        <div className="card coach-card">
          <div className="card-label">Your Plan</div>
          <div className="card-value">{plan.name}</div>
          <div className="coach-meta">
            Week {weeksActive} · {plan.daysPerWeek}x/week · {plan.durationMin}min · {plan.goal}
          </div>
          <div className="coach-meta">
            Target RIR: {targetRIR} · Progression: {profile.progression}
          </div>
        </div>
      )}

      {/* Quick stats */}
      <div className="coach-stats-grid">
        <div className="card coach-stat-card">
          <div className="coach-stat-value">{metadata.totalSessions}</div>
          <div className="coach-stat-label">Sessions</div>
        </div>
        <div className="card coach-stat-card">
          <div className="coach-stat-value">{weeksActive}</div>
          <div className="coach-stat-label">Weeks</div>
        </div>
        <div className="card coach-stat-card">
          <div className="coach-stat-value">{metadata.fatigueScore}</div>
          <div className="coach-stat-label">Fatigue</div>
        </div>
      </div>

      {/* Cardio compliance */}
      <div className="card coach-card">
        <div className="card-label">Weekly Cardio</div>
        <div className="cardio-progress">
          <div className="cardio-progress-fill" style={{ width: `${cardioPercent}%` }} />
        </div>
        <div className="cardio-status">
          {Math.round(weeklyCardioMinutes)} / {cardioTarget} min ({cardioPercent}%)
        </div>
        {cardioPercent < 50 && weeklyCardioMinutes < cardioTarget && (
          <div className="coach-nudge">
            Try 10 min of cardio before your next session — it counts!
          </div>
        )}
      </div>

      {/* Coaching philosophy */}
      <div className="card coach-card">
        <div className="card-label">Philosophy</div>
        <div className="coach-philosophy">
          Always attempt to do better than last time. Progressive overload
          isn't just adding weight — it's more reps, better technique, shorter rest,
          or pushing closer to failure. Consistency beats intensity.
        </div>
      </div>

      {/* Plan days */}
      {plan && (
        <div className="card coach-card">
          <div className="card-label">Training Days</div>
          <div className="coach-days-list">
            {plan.days.map((day, i) => (
              <div key={i} className="coach-day-item">
                <span className="coach-day-name">{day.dayName}</span>
                <span className="coach-day-count">{day.exercises.length} exercises</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Settings link */}
      <button
        className="btn-secondary coach-settings-btn"
        onClick={() => navigate('/coach/settings')}
      >
        Coach Settings
      </button>
    </div>
  );
}
