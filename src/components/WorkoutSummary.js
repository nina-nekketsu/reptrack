// src/components/WorkoutSummary.js — Post-workout summary modal
import React from 'react';
import { getPlanById } from '../data/trainingPlans';

// Motivational closing messages — PRD Section 6.2 key phrases
const CLOSING_MESSAGES = [
  'You showed up. That\'s the hardest part. Everything else follows.',
  'Harder than last time — that\'s all that matters.',
  'This is a marathon, not a sprint. Another session in the bank.',
  'Consistency beats intensity. You\'re building something.',
  'Effort overrides variety. You did the work today.',
];

export default function WorkoutSummary({ summary, planId, cardioMinutes, onClose }) {
  if (!summary) return null;

  const plan = planId ? getPlanById(planId) : null;

  // Determine next day in the plan rotation
  let nextDayPreview = null;
  if (plan && plan.days.length > 1) {
    nextDayPreview = plan.days.map(d => d.dayName).join(' / ');
  }

  const durationMin = summary.duration
    ? Math.floor(summary.duration / 60000)
    : null;

  const closingMsg = CLOSING_MESSAGES[Math.floor(Math.random() * CLOSING_MESSAGES.length)];

  return (
    <div className="workout-summary-overlay" onClick={onClose}>
      <div className="workout-summary" onClick={e => e.stopPropagation()}>
        <div className="ws-header">
          <h2 className="ws-title">Workout Complete</h2>
          <p className="ws-subtitle">{summary.exerciseCount} exercises logged</p>
        </div>

        <div className="ws-stats">
          <div className="ws-stat">
            <span className="ws-stat-value">{summary.totalSets}</span>
            <span className="ws-stat-label">Sets</span>
          </div>
          <div className="ws-stat">
            <span className="ws-stat-value">{(summary.totalVolume / 1000).toFixed(1)}t</span>
            <span className="ws-stat-label">Volume</span>
          </div>
          {durationMin != null && (
            <div className="ws-stat">
              <span className="ws-stat-value">{durationMin}m</span>
              <span className="ws-stat-label">Duration</span>
            </div>
          )}
        </div>

        {/* Improvements */}
        {summary.improvements.length > 0 && (
          <>
            <p className="ws-section-title">Progressive Overload Wins</p>
            <div className="ws-improvements">
              {summary.improvements.map((item, i) => (
                <div key={i} className="ws-item ws-item--up">
                  <span className="ws-item-icon">+</span>
                  <span>{item.exercise}</span>
                  {item.levers.map((l, j) => (
                    <span key={j} className="coach-fb-lever coach-fb-lever--up">
                      {l.lever}: {l.from}>{l.to}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}

        {/* Regressions */}
        {summary.regressions.length > 0 && (
          <>
            <p className="ws-section-title">Below Last Time</p>
            <div className="ws-regressions">
              {summary.regressions.map((item, i) => (
                <div key={i} className="ws-item ws-item--down">
                  <span className="ws-item-icon">-</span>
                  <span>{item.exercise}</span>
                </div>
              ))}
            </div>
            {summary.regressions.length > 0 && summary.improvements.length === 0 && (
              <p className="ws-regression-note">
                Off days happen. Zoom out — monthly progress matters more than one session.
              </p>
            )}
          </>
        )}

        {/* Maintained + first time counts */}
        {(summary.maintainedCount > 0 || summary.firstTimeCount > 0) && (
          <p className="ws-section-title" style={{ color: 'var(--c-text)' }}>
            {summary.maintainedCount > 0 && `${summary.maintainedCount} maintained`}
            {summary.maintainedCount > 0 && summary.firstTimeCount > 0 && ' · '}
            {summary.firstTimeCount > 0 && `${summary.firstTimeCount} first-time`}
          </p>
        )}

        {/* Cardio progress */}
        {cardioMinutes != null && (
          <div className="ws-cardio-row">
            <span className="ws-cardio-label">Weekly Cardio</span>
            <span className="ws-cardio-value">{Math.round(cardioMinutes)} / 150 min</span>
          </div>
        )}

        {/* Next session preview */}
        {nextDayPreview && (
          <div className="ws-next-session">
            <div className="ws-next-label">Next Session</div>
            <div>{nextDayPreview}</div>
          </div>
        )}

        {/* Motivational closing */}
        <p className="ws-closing">{closingMsg}</p>

        <button className="ws-close-btn" onClick={onClose}>Done</button>
      </div>
    </div>
  );
}
