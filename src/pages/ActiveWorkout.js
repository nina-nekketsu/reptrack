import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ExerciseLogModal from '../components/ExerciseLogModal';
import WorkoutSummary from '../components/WorkoutSummary';
import { useTimer } from '../context/TimerContext';
import { useCoach } from '../context/CoachContext';
import { loadLogs } from '../utils/exerciseHelpers';
import {
  detectOverload,
  getPreviousSets,
  calculateFatigueAdjustment,
  generateSessionSummary,
} from '../lib/coachEngine';
import './Page.css';
import './Exercises.css';
import './Workouts.css';
import './ActiveWorkout.css';
import '../components/CoachComponents.css';

// Muscle-group emoji map (same as Workouts.js)
const GROUP_EMOJI = {
  Chest: '🏋️',
  Back: '🔙',
  Legs: '🦵',
  Shoulders: '🙆',
  Arms: '💪',
  Core: '🧘',
  default: '⚡',
};

function thumbEmoji(muscleGroup) {
  return GROUP_EMOJI[muscleGroup] || GROUP_EMOJI.default;
}

function formatElapsed(startIso) {
  if (!startIso) return '0:00';
  const secs = Math.floor((Date.now() - new Date(startIso).getTime()) / 1000);
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function loadActiveSession() {
  try {
    const raw = localStorage.getItem('activeWorkoutSession');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveActiveSession(session) {
  if (session) {
    localStorage.setItem('activeWorkoutSession', JSON.stringify(session));
  } else {
    localStorage.removeItem('activeWorkoutSession');
  }
}

function loadPlans() {
  try {
    const raw = localStorage.getItem('workoutPlans');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function loadExercises() {
  try {
    const raw = localStorage.getItem('exercises');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function ActiveWorkout() {
  const { planId } = useParams();
  const navigate = useNavigate();
  const timer = useTimer();
  const coach = useCoach();

  const [plans] = useState(loadPlans);
  const [allExercises] = useState(loadExercises);
  const [logs, setLogs] = useState(loadLogs);
  const [activeSession, setActiveSession] = useState(loadActiveSession);
  const [elapsed, setElapsed] = useState('0:00');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [warmupDismissed, setWarmupDismissed] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);

  const plan = plans.find((p) => p.id === planId);

  // Activate coach when workout starts
  useEffect(() => {
    if (coach.isOnboarded && activeSession) {
      coach.activateCoach();
    }
    return () => {
      // Don't deactivate here — let handleEndWorkout do it
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSession, coach.isOnboarded]);

  // If no plan found or no active session for this plan, start one or redirect
  useEffect(() => {
    if (!plan) {
      navigate('/workouts', { replace: true });
      return;
    }

    // If there's no active session or it's for a different plan, create one
    if (!activeSession || activeSession.planId !== planId) {
      const session = {
        planId: plan.id,
        planName: plan.name,
        startedAt: new Date().toISOString(),
      };
      setActiveSession(session);
      saveActiveSession(session);
    }
  }, [plan, planId, activeSession, navigate]);

  // Tick elapsed time
  useEffect(() => {
    if (!activeSession) return;
    const iv = setInterval(() => {
      setElapsed(formatElapsed(activeSession.startedAt));
    }, 1000);
    setElapsed(formatElapsed(activeSession.startedAt));
    return () => clearInterval(iv);
  }, [activeSession]);

  const getExercise = useCallback(
    (id) => allExercises.find((e) => e.id === id),
    [allExercises]
  );

  // Check if an exercise has been logged during this session
  function isLoggedThisSession(exerciseId) {
    if (!activeSession) return false;
    const sessions = logs[exerciseId];
    if (!sessions || sessions.length === 0) return false;
    const sessionStart = new Date(activeSession.startedAt).getTime();
    return sessions.some((s) => new Date(s.date).getTime() >= sessionStart);
  }

  // Count how many exercises are completed
  const completedCount = plan
    ? plan.exercises.filter((pe) => isLoggedThisSession(pe.exerciseId)).length
    : 0;
  const totalExercises = plan ? plan.exercises.length : 0;

  function handleEndWorkout() {
    timer.stopAll();

    // Generate workout summary if coach is active
    if (coach.isOnboarded && plan && activeSession) {
      const currentLogs = loadLogs();
      const sessionStart = new Date(activeSession.startedAt);
      const exerciseResults = [];

      for (const planEx of plan.exercises) {
        const exSessions = currentLogs[planEx.exerciseId] || [];
        const sessionsDuringWorkout = exSessions.filter(
          s => new Date(s.date) >= sessionStart
        );
        if (sessionsDuringWorkout.length > 0) {
          const latestSession = sessionsDuringWorkout[sessionsDuringWorkout.length - 1];
          const prevSets = getPreviousSets(planEx.exerciseId, activeSession.startedAt);
          const lastSet = latestSession.sets[latestSession.sets.length - 1] || {};
          const overload = detectOverload(planEx.exerciseId, lastSet, prevSets);
          const ex = allExercises.find(e => e.id === planEx.exerciseId);
          exerciseResults.push({
            exerciseName: ex?.name || planEx.exerciseId,
            overload,
            setsLogged: latestSession.sets.length,
            volume: latestSession.totalVolume || 0,
          });
        }
      }

      if (exerciseResults.length > 0) {
        const duration = Date.now() - sessionStart.getTime();
        const summary = generateSessionSummary(exerciseResults, duration, coach.profile.goal);
        setSummaryData(summary);
        setShowSummary(true);

        // Update coaching metadata
        const fatigueAdj = calculateFatigueAdjustment(exerciseResults.map(r => r.overload));
        coach.updateMetadata({
          fatigueScore: Math.max(0, Math.min(100, coach.metadata.fatigueScore + fatigueAdj)),
          totalSessions: coach.metadata.totalSessions + 1,
          lastSessionDate: new Date().toISOString(),
        });

        coach.deactivateCoach();
        setActiveSession(null);
        saveActiveSession(null);
        return; // Don't navigate yet — show summary first
      }
    }

    coach.deactivateCoach();
    setActiveSession(null);
    saveActiveSession(null);
    navigate('/workouts', { replace: true });
  }

  function handleCloseSummary() {
    setShowSummary(false);
    setSummaryData(null);
    navigate('/workouts', { replace: true });
  }

  function handleLogSaved(updatedLogs) {
    setLogs(updatedLogs);
  }

  function openExerciseLog(exercise) {
    setSelectedExercise(exercise);
  }

  function closeExerciseLog() {
    setSelectedExercise(null);
  }

  if (!plan) return null;

  return (
    <div className="page active-workout-page">
      {/* Session header */}
      <div className="aw-header">
        <div className="aw-header__top">
          <div className="aw-header__info">
            <div className="aw-header__label">Active Workout</div>
            <div className="aw-header__name">{plan.name}</div>
          </div>
          <button className="aw-end-btn" onClick={() => setShowEndConfirm(true)}>
            End Workout
          </button>
        </div>

        <div className="aw-header__stats">
          <div className="aw-stat">
            <span className="aw-stat__icon">⏱</span>
            <span className="aw-stat__value">{elapsed}</span>
            <span className="aw-stat__label">Elapsed</span>
          </div>
          <div className="aw-stat">
            <span className="aw-stat__icon">✅</span>
            <span className="aw-stat__value">{completedCount}/{totalExercises}</span>
            <span className="aw-stat__label">Exercises</span>
          </div>
        </div>

        {/* Progress bar */}
        <div className="aw-progress-bar">
          <div
            className="aw-progress-bar__fill"
            style={{ width: totalExercises > 0 ? `${(completedCount / totalExercises) * 100}%` : '0%' }}
          />
        </div>
      </div>

      {/* Warm-up prompt — PRD Section 5.4.3 */}
      {coach.isOnboarded && !warmupDismissed && completedCount === 0 && (
        <div className="aw-warmup-banner">
          <div className="aw-warmup-text">
            <strong>10-min warm-up?</strong>
            <span>Start with moderate steady-state cardio. It prevents injury and counts toward your 150-min weekly target.</span>
          </div>
          <div className="aw-warmup-actions">
            <button
              className="aw-warmup-btn aw-warmup-btn--yes"
              onClick={() => {
                coach.addCardioLog({ type: 'other', minutes: 10 });
                setWarmupDismissed(true);
              }}
            >
              Done it
            </button>
            <button
              className="aw-warmup-btn aw-warmup-btn--skip"
              onClick={() => setWarmupDismissed(true)}
            >
              Skip
            </button>
          </div>
        </div>
      )}

      {/* Exercise list */}
      <div className="aw-exercise-list">
        {plan.exercises.map((planEx, i) => {
          const ex = getExercise(planEx.exerciseId);
          if (!ex) return null;
          const done = isLoggedThisSession(planEx.exerciseId);

          return (
            <div
              key={`${planEx.exerciseId}-${i}`}
              className={`aw-exercise-row ${done ? 'aw-exercise-row--done' : ''}`}
              onClick={() => openExerciseLog(ex)}
            >
              <div className="aw-exercise-status">
                <span className="aw-number">{i + 1}</span>
              </div>

              <div className="aw-exercise-thumb">
                {thumbEmoji(ex.muscleGroup)}
              </div>

              <div className="aw-exercise-info">
                <div className={`aw-exercise-name ${done ? 'aw-exercise-name--done' : ''}`}>
                  {ex.name}
                </div>
                <div className="aw-exercise-meta">
                  {ex.muscleGroup} · {planEx.prescribedSets}×{planEx.prescribedReps}
                </div>
              </div>

              <div className="aw-exercise-action">
                {done ? (
                  <span className="aw-logged-badge">Logged</span>
                ) : (
                  <span className="aw-log-btn">Log</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Completion message */}
      {completedCount === totalExercises && totalExercises > 0 && (
        <div className="aw-complete-banner">
          <span className="aw-complete-icon">🎉</span>
          <div className="aw-complete-text">
            <strong>All exercises completed!</strong>
            <span>Great workout. End session when ready.</span>
          </div>
        </div>
      )}

      {/* Exercise log modal */}
      {selectedExercise && (
        <ExerciseLogModal
          exercise={selectedExercise}
          logs={logs}
          onClose={closeExerciseLog}
          onSaved={handleLogSaved}
        />
      )}

      {/* Post-workout summary */}
      {showSummary && summaryData && (
        <WorkoutSummary
          summary={summaryData}
          planId={coach.profile.planId}
          cardioMinutes={coach.isOnboarded ? coach.weeklyCardioMinutes : null}
          onClose={handleCloseSummary}
        />
      )}

      {/* End workout confirmation overlay */}
      {showEndConfirm && (
        <div className="aw-end-overlay" onClick={() => setShowEndConfirm(false)}>
          <div className="aw-end-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="aw-end-confirm__check">✓</div>
            <h3 className="aw-end-confirm__title">End Workout?</h3>
            <p className="aw-end-confirm__subtitle">
              {completedCount}/{totalExercises} exercises logged · {elapsed}
            </p>
            <div className="aw-end-confirm__actions">
              <button
                className="aw-end-confirm__btn aw-end-confirm__btn--cancel"
                onClick={() => setShowEndConfirm(false)}
              >
                Keep Going
              </button>
              <button
                className="aw-end-confirm__btn aw-end-confirm__btn--confirm"
                onClick={() => {
                  setShowEndConfirm(false);
                  handleEndWorkout();
                }}
              >
                End & Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
