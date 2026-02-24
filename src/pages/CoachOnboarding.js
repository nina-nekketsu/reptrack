// src/pages/CoachOnboarding.js — Multi-step coach assessment
import React, { useState } from 'react';
import { useCoach } from '../context/CoachContext';
import { recommendPlan, getPlanById } from '../data/trainingPlans';
import './CoachOnboarding.css';

const STEPS = [
  'experience', 'daysPerWeek', 'sessionDuration',
  'goal', 'equipment', 'injuries', 'planRecommendation', 'progression',
];

export default function CoachOnboarding({ onComplete }) {
  const { completeOnboarding } = useCoach();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    experience: null,
    daysPerWeek: null,
    sessionDuration: null,
    goal: null,
    equipment: null,
    injuries: '',
    planId: null,
    progression: 'conservative',
  });

  const currentStep = STEPS[step];
  const canNext = (() => {
    switch (currentStep) {
      case 'experience':       return data.experience !== null;
      case 'daysPerWeek':      return data.daysPerWeek !== null;
      case 'sessionDuration':  return data.sessionDuration !== null;
      case 'goal':             return data.goal !== null;
      case 'equipment':        return data.equipment !== null;
      case 'injuries':         return true;
      case 'planRecommendation': return data.planId !== null;
      case 'progression':      return true;
      default: return false;
    }
  })();

  function next() {
    if (step === STEPS.length - 1) {
      // Final step — complete onboarding
      completeOnboarding({
        experience: data.experience,
        daysPerWeek: data.daysPerWeek,
        sessionDuration: data.sessionDuration,
        goal: data.goal,
        equipment: data.equipment,
        injuries: data.injuries ? data.injuries.split(',').map(s => s.trim()).filter(Boolean) : [],
        planId: data.planId,
        progression: data.progression,
      });
      if (onComplete) onComplete();
      return;
    }

    // Auto-recommend plan when entering plan step
    if (STEPS[step + 1] === 'planRecommendation' && !data.planId) {
      const rec = recommendPlan({
        daysPerWeek: data.daysPerWeek,
        durationMin: data.sessionDuration,
        goal: data.goal,
      });
      setData(d => ({ ...d, planId: rec.id }));
    }

    // Auto-assign progression based on experience
    if (STEPS[step + 1] === 'progression') {
      const prog = (data.experience === 'never' || data.experience === 'beginner')
        ? 'conservative' : 'moderate';
      setData(d => ({ ...d, progression: prog }));
    }

    setStep(s => s + 1);
  }

  function back() {
    if (step > 0) setStep(s => s - 1);
  }

  function select(field, value) {
    setData(d => ({ ...d, [field]: value }));
  }

  const plan = data.planId ? getPlanById(data.planId) : null;

  return (
    <div className="coach-onboarding">
      <div className="co-progress">
        <div className="co-progress-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      <div className="co-content">
        {/* Step 1: Experience */}
        {currentStep === 'experience' && (
          <>
            <h2 className="co-title">What's your training experience?</h2>
            <p className="co-sub">Be honest — this determines your starting intensity.</p>
            <div className="co-options">
              {[
                { value: 'never', label: 'Brand New', desc: 'Never trained seriously' },
                { value: 'beginner', label: 'Beginner', desc: 'Less than 6 months' },
                { value: 'intermediate', label: 'Intermediate', desc: '6 months to 2 years' },
                { value: 'advanced', label: 'Advanced', desc: '2+ years consistent' },
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`co-option ${data.experience === opt.value ? 'co-option--active' : ''}`}
                  onClick={() => select('experience', opt.value)}
                >
                  <span className="co-option-label">{opt.label}</span>
                  <span className="co-option-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 2: Days per week */}
        {currentStep === 'daysPerWeek' && (
          <>
            <h2 className="co-title">How many days can you train?</h2>
            <p className="co-sub">Pick your honest minimum — consistency beats intensity.</p>
            <div className="co-options co-options--grid">
              {[1, 2, 3, 4, 5, 6].map(n => (
                <button
                  key={n}
                  className={`co-option co-option--compact ${data.daysPerWeek === n ? 'co-option--active' : ''}`}
                  onClick={() => select('daysPerWeek', n)}
                >
                  <span className="co-option-label">{n}</span>
                  <span className="co-option-desc">day{n > 1 ? 's' : ''}/wk</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Session duration */}
        {currentStep === 'sessionDuration' && (
          <>
            <h2 className="co-title">How long per session?</h2>
            <p className="co-sub">Including warm-up. Be realistic.</p>
            <div className="co-options">
              <button
                className={`co-option ${data.sessionDuration === 60 ? 'co-option--active' : ''}`}
                onClick={() => select('sessionDuration', 60)}
              >
                <span className="co-option-label">60 minutes</span>
                <span className="co-option-desc">Efficient, focused sessions</span>
              </button>
              <button
                className={`co-option ${data.sessionDuration === 90 ? 'co-option--active' : ''}`}
                onClick={() => select('sessionDuration', 90)}
              >
                <span className="co-option-label">90 minutes</span>
                <span className="co-option-desc">More volume, more exercises</span>
              </button>
            </div>
          </>
        )}

        {/* Step 4: Goal */}
        {currentStep === 'goal' && (
          <>
            <h2 className="co-title">Primary goal?</h2>
            <p className="co-sub">This shapes your rep ranges and rest times.</p>
            <div className="co-options">
              <button
                className={`co-option ${data.goal === 'hypertrophy' ? 'co-option--active' : ''}`}
                onClick={() => select('goal', 'hypertrophy')}
              >
                <span className="co-option-label">Hypertrophy</span>
                <span className="co-option-desc">Build muscle size. Higher reps, more TUT.</span>
              </button>
              <button
                className={`co-option ${data.goal === 'strength' ? 'co-option--active' : ''}`}
                onClick={() => select('goal', 'strength')}
              >
                <span className="co-option-label">Strength</span>
                <span className="co-option-desc">Get stronger. Lower reps, heavier loads.</span>
              </button>
            </div>
          </>
        )}

        {/* Step 5: Equipment */}
        {currentStep === 'equipment' && (
          <>
            <h2 className="co-title">What equipment do you have?</h2>
            <p className="co-sub">We'll pick exercises that match your setup.</p>
            <div className="co-options">
              {[
                { value: 'full-gym', label: 'Full Gym', desc: 'Barbells, cables, machines — the works' },
                { value: 'home', label: 'Home Gym', desc: 'Dumbbells, bench, maybe bands' },
                { value: 'bodyweight', label: 'Bodyweight Only', desc: 'No equipment needed' },
              ].map(opt => (
                <button
                  key={opt.value}
                  className={`co-option ${data.equipment === opt.value ? 'co-option--active' : ''}`}
                  onClick={() => select('equipment', opt.value)}
                >
                  <span className="co-option-label">{opt.label}</span>
                  <span className="co-option-desc">{opt.desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 6: Injuries */}
        {currentStep === 'injuries' && (
          <>
            <h2 className="co-title">Any injuries or limitations?</h2>
            <p className="co-sub">Optional. We'll avoid exercises that cause pain.</p>
            <textarea
              className="co-textarea"
              placeholder="e.g. bad left shoulder, knee issues..."
              value={data.injuries}
              onChange={e => setData(d => ({ ...d, injuries: e.target.value }))}
              rows={3}
            />
            <p className="co-hint">Leave blank if none. Separate multiple with commas.</p>
          </>
        )}

        {/* Step 7: Plan recommendation */}
        {currentStep === 'planRecommendation' && plan && (
          <>
            <h2 className="co-title">Your recommended plan</h2>
            <p className="co-sub">Based on your answers, here's what fits you best.</p>
            <div className="co-plan-card">
              <div className="co-plan-name">{plan.name}</div>
              <div className="co-plan-details">
                <span>{plan.daysPerWeek} day{plan.daysPerWeek > 1 ? 's' : ''}/week</span>
                <span>{plan.durationMin} min</span>
                <span>{plan.goal}</span>
                <span>{plan.split}</span>
              </div>
              <div className="co-plan-days">
                {plan.days.map((day, i) => (
                  <div key={i} className="co-plan-day">
                    <div className="co-plan-day-name">{day.dayName}</div>
                    <div className="co-plan-day-count">{day.exercises.length} exercises</div>
                  </div>
                ))}
              </div>
            </div>
            <p className="co-hint">You can change your plan later in Coach Settings.</p>
          </>
        )}

        {/* Step 8: Progression */}
        {currentStep === 'progression' && (
          <>
            <h2 className="co-title">Progression speed</h2>
            <p className="co-sub">How quickly should we ramp up intensity?</p>
            <div className="co-options">
              <button
                className={`co-option ${data.progression === 'conservative' ? 'co-option--active' : ''}`}
                onClick={() => select('progression', 'conservative')}
              >
                <span className="co-option-label">Conservative</span>
                <span className="co-option-desc">Slower ramp. 6-10 RIR week 1, all-out by month 2+. Best for beginners.</span>
              </button>
              <button
                className={`co-option ${data.progression === 'moderate' ? 'co-option--active' : ''}`}
                onClick={() => select('progression', 'moderate')}
              >
                <span className="co-option-label">Moderate</span>
                <span className="co-option-desc">Faster ramp. 3-4 RIR week 1, all-out by week 4+. For experienced lifters.</span>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Navigation */}
      <div className="co-nav">
        {step > 0 && (
          <button className="co-nav-btn co-nav-btn--back" onClick={back}>Back</button>
        )}
        <button
          className="co-nav-btn co-nav-btn--next"
          onClick={next}
          disabled={!canNext}
        >
          {step === STEPS.length - 1 ? 'Start Coaching' : 'Next'}
        </button>
      </div>
    </div>
  );
}
