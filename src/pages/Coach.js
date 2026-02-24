// src/pages/Coach.js — Main Coach dashboard (entry point for Coach tab)
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCoach } from '../context/CoachContext';
import { getPlanById } from '../data/trainingPlans';
import CoachOnboarding from './CoachOnboarding';
import './Coach.css';

const FAQ_ITEMS = [
  { q: 'Why compound movements before isolation?', a: 'Compound movements (squat, bench, row) work multiple muscle groups and need your freshest energy. Save isolation exercises (curls, raises) for after. This order maximizes your performance on the hardest lifts.' },
  { q: 'I\'m still sore — should I train?', a: 'Soreness tells you about recovery status. If it\'s mild, train through it — the warm-up usually helps. If it\'s debilitating, reduce intensity or add an extra rest day. Train easier than last time until recovered.' },
  { q: 'I can\'t add weight — am I stuck?', a: 'Progressive overload isn\'t just weight. Try: more reps, slower eccentrics, shorter rest, deeper range of motion, or a pause at peak contraction. There are no rules — find the lever that works for you.' },
  { q: 'Why are biceps on leg day?', a: 'Biceps are fresh on leg day because there\'s no pulling work. After back day they\'re pre-fatigued. Training each body part 2-3x/week is superior to the old-school bro split.' },
  { q: 'Should I do cardio?', a: 'Cardio is non-negotiable. Your heart is the most important muscle. 150 minutes of moderate steady-state per week. The 10-min warm-up before lifting counts toward this target.' },
  { q: 'I\'m not losing weight despite training.', a: 'Are you tracking calories? Are you doing your cardio? Weight loss requires a calorie deficit — training alone won\'t do it. Track food intake, hit your cardio, and adjust.' },
  { q: 'When should I switch plans?', a: 'Effort overrides variety. Stick with your current plan for at least a few months. Only change for valid reasons: boredom, injury, equipment change, or months with zero progress.' },
  { q: 'Can women follow the same plans?', a: 'Absolutely. Women can and should train just as hard. Follow the plans as written. If you want more lower-body focus, swap upper-body accessory exercises for additional lower-body work.' },
];

export default function Coach() {
  const navigate = useNavigate();
  const {
    isOnboarded, profile, metadata,
    weeksActive, targetRIR,
    weeklyCardioMinutes, cardioTarget,
  } = useCoach();
  const [openFaq, setOpenFaq] = useState(null);

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

      {/* Deload suggestion — PRD Section 10 */}
      {metadata.fatigueScore >= 60 && (
        <div className="card coach-card coach-deload-card">
          <div className="card-label">Recovery Check</div>
          <div className="coach-deload-text">
            {metadata.fatigueScore >= 80
              ? 'Your fatigue is high. Consider training easier than last time for a few sessions, or take a couple rest days focused on cardio. This is a marathon, not a sprint.'
              : 'Fatigue is building up. Keep an eye on recovery — if you\'re feeling beat up, it\'s okay to pull back. Train smarter, not just harder.'}
          </div>
        </div>
      )}

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

      {/* FAQ — PRD Section 7.4 */}
      <div className="card coach-card">
        <div className="card-label">Common Questions</div>
        <div className="coach-faq-list">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="coach-faq-item">
              <button
                className="coach-faq-q"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span>{item.q}</span>
                <span className="coach-faq-arrow">{openFaq === i ? '-' : '+'}</span>
              </button>
              {openFaq === i && (
                <div className="coach-faq-a">{item.a}</div>
              )}
            </div>
          ))}
        </div>
      </div>

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
