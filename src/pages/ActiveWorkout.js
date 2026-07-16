import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ExerciseLogModal from '../components/ExerciseLogModal';
import WorkoutSummary from '../components/WorkoutSummary';
import { useTimer } from '../context/TimerContext';
import { useCoach } from '../context/CoachContext';
import { useAuth } from '../context/AuthContext';
import { loadLogs } from '../utils/exerciseHelpers';
import {
  detectOverload,
  getPreviousSets,
  calculateFatigueAdjustment,
  generateSessionSummary,
} from '../lib/coachEngine';
import {
  getStoredVisibleActiveWorkoutSession,
  saveActiveWorkoutSession,
} from '../lib/activeWorkoutSession';
import { pushActiveWorkoutSession } from '../lib/sync';
import { beginCoachWorkout, endCoachWorkout } from '../lib/coachCloud';
import {
  countCompletedSets,
  getExerciseProgressState,
  getNextIncompleteIndex,
  getRestRecommendation,
} from '../utils/workoutProgress';
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
  const secs = Math.max(0, Math.floor((Date.now() - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
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
  const { user } = useAuth();

  const [plans] = useState(loadPlans);
  const [allExercises] = useState(loadExercises);
  const [logs, setLogs] = useState(loadLogs);
  const [activeSession, setActiveSession] = useState(getStoredVisibleActiveWorkoutSession);
  const [elapsed, setElapsed] = useState('0:00');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [selectedPlanExercise, setSelectedPlanExercise] = useState(null);
  const [completedExerciseIds, setCompletedExerciseIds] = useState(
    () => getStoredVisibleActiveWorkoutSession()?.completedExerciseIds || []
  );
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [warmupDismissed, setWarmupDismissed] = useState(false);
  const [showWorkoutMenu, setShowWorkoutMenu] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const startedCoachSessionRef = useRef(null);

  const plan = plans.find((p) => p.id === planId);

  // Activate coach when workout starts
  useEffect(() => {
    if (
      coach.isOnboarded
      && activeSession
      && startedCoachSessionRef.current !== activeSession.startedAt
    ) {
      startedCoachSessionRef.current = activeSession.startedAt;
      coach.activateCoach();
      beginCoachWorkout(activeSession).catch((error) => {
        console.warn('[coach] cloud workout start failed:', error);
      });
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
      const now = new Date().toISOString();
      const session = saveActiveWorkoutSession({
        action: 'start',
        planId: plan.id,
        planName: plan.name,
        now,
      });
      pushActiveWorkoutSession(user?.id);
      setActiveSession(session);
      setCompletedExerciseIds(session.completedExerciseIds || []);
    }
  }, [plan, planId, activeSession, navigate, user?.id]);

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

  // Count sets logged during this active session for a given exercise
  function getSetsLoggedThisSession(exerciseId) {
    if (!activeSession) return 0;
    const sessions = logs[exerciseId];
    if (!sessions || sessions.length === 0) return 0;
    const sessionStart = new Date(activeSession.startedAt).getTime();
    let total = 0;
    for (const s of sessions) {
      if (new Date(s.workoutSessionStartedAt || s.date).getTime() >= sessionStart) {
        total += countCompletedSets(s.sets || []);
      }
    }
    return total;
  }

  // Check if ALL prescribed sets are logged
  function isFullyLogged(exerciseId, prescribedSets) {
    return completedExerciseIds.includes(exerciseId)
      || getSetsLoggedThisSession(exerciseId) >= (prescribedSets || 1);
  }

  const exerciseProgress = plan
    ? plan.exercises.map((planExercise, index) => {
        const exercise = getExercise(planExercise.exerciseId);
        const setsLogged = getSetsLoggedThisSession(planExercise.exerciseId);
        const targetSets = planExercise.prescribedSets || 1;
        const done = isFullyLogged(planExercise.exerciseId, targetSets);
        return {
          done,
          exercise,
          index,
          planExercise,
          progressState: getExerciseProgressState(setsLogged, targetSets, done),
          setsLogged,
          targetSets,
        };
      })
    : [];
  const completedCount = exerciseProgress.filter(({ done }) => done).length;
  const totalExercises = exerciseProgress.length;
  const nextExerciseIndex = getNextIncompleteIndex(
    exerciseProgress.map(({ done, exercise }) => done || !exercise)
  );
  const nextExercise = nextExerciseIndex >= 0 ? exerciseProgress[nextExerciseIndex] : null;
  const restRecommendation = getRestRecommendation(nextExercise?.planExercise);

  function handleEndWorkout() {
    timer.stopAll();
    endCoachWorkout(activeSession, {
      status: 'ended',
      completedExerciseIds,
    }).catch((error) => {
      console.warn('[coach] cloud workout end failed:', error);
    });

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
        saveActiveWorkoutSession({ action: 'end', now: new Date().toISOString() });
        pushActiveWorkoutSession(user?.id);
        setActiveSession(null);
        return; // Don't navigate yet — show summary first
      }
    }

    coach.deactivateCoach();
    saveActiveWorkoutSession({ action: 'end', now: new Date().toISOString() });
    pushActiveWorkoutSession(user?.id);
    setActiveSession(null);
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

  function openExerciseLog(exercise, planExercise) {
    setSelectedExercise(exercise);
    setSelectedPlanExercise(planExercise);
  }

  function closeExerciseLog() {
    setSelectedExercise(null);
    setSelectedPlanExercise(null);
  }

  function handleExerciseCompletion(exerciseId, done) {
    const next = done
      ? [...new Set([...completedExerciseIds, exerciseId])]
      : completedExerciseIds.filter((id) => id !== exerciseId);
    setCompletedExerciseIds(next);
    const updatedSession = saveActiveWorkoutSession({
      action: 'update',
      patch: { completedExerciseIds: next },
      now: new Date().toISOString(),
    });
    if (updatedSession) setActiveSession(updatedSession);
    pushActiveWorkoutSession(user?.id);
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
          <div className="aw-header__elapsed" aria-label={`${elapsed} elapsed`}>{elapsed}</div>
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
        {exerciseProgress.map((progress) => {
          const {
            done,
            exercise: ex,
            index: i,
            planExercise: planEx,
            progressState,
            setsLogged,
            targetSets,
          } = progress;

          if (!ex) {
            return (
              <div
                key={`${planEx.exerciseId}-${i}`}
                className="aw-exercise-row aw-exercise-row--missing"
              >
                <div className="aw-exercise-status" aria-hidden="true">
                  <span className="aw-number">{i + 1}</span>
                </div>
                <div className="aw-exercise-info">
                  <div className="aw-exercise-name">Unknown exercise (removed?)</div>
                  <div className="aw-exercise-meta">This plan entry can no longer be logged.</div>
                </div>
                <button
                  className="aw-edit-plan-btn"
                  onClick={() => navigate('/workouts')}
                >
                  Edit plan
                </button>
              </div>
            );
          }

          const partial = progressState === 'partial' || progressState === 'almost';
          const isNext = i === nextExerciseIndex;

          return (
            <div
              key={`${planEx.exerciseId}-${i}`}
              className={`aw-exercise-row aw-exercise-row--${progressState} ${planEx.superset ? 'aw-exercise-row--superset' : ''} ${isNext ? 'aw-exercise-row--next' : ''}`}
              onClick={() => openExerciseLog(ex, planEx)}
            >
              <div className="aw-exercise-status">
                {done ? (
                  <span className="aw-check" aria-label={`${ex.name} completed`}>✓</span>
                ) : (
                  <span className="aw-number">{i + 1}</span>
                )}
              </div>

              <div className="aw-exercise-thumb">
                {thumbEmoji(ex.muscleGroup)}
              </div>

              <div className="aw-exercise-info">
                {isNext && <div className="aw-exercise-next-label">Next</div>}
                <div className={`aw-exercise-name ${done ? 'aw-exercise-name--done' : ''}`}>
                  {ex.name}
                </div>
                <div className="aw-exercise-meta">
                  {ex.muscleGroup} · {planEx.prescribedSets}×{planEx.prescribedReps}
                  {planEx.superset ? ` · Superset ${planEx.superset} · ${getRestRecommendation(planEx).rangeLabel}` : ''}
                </div>
              </div>

              <div className="aw-exercise-action">
                {done ? (
                  <span className="aw-logged-badge">Logged</span>
                ) : partial ? (
                  <span className="aw-partial-badge">{setsLogged}/{targetSets}</span>
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

      <div className="aw-bottom-bar">
        <button
          className="aw-bottom-bar__next"
          disabled={!nextExercise}
          onClick={() => nextExercise && openExerciseLog(nextExercise.exercise, nextExercise.planExercise)}
        >
          {nextExercise ? `Log next: ${nextExercise.exercise.name}` : 'All exercises logged'}
        </button>
        <div className="aw-bottom-bar__secondary">
          <button
            className="aw-bottom-bar__rest"
            disabled={timer.isResting}
            onClick={() => timer.startRest(restRecommendation.milliseconds)}
          >
            {timer.isResting ? `Rest ${timer.restDisplay}` : `Rest ${restRecommendation.label}`}
          </button>
          <button
            className="aw-bottom-bar__menu"
            aria-label="Workout menu"
            aria-haspopup="dialog"
            onClick={() => setShowWorkoutMenu(true)}
          >
            ⋯
          </button>
        </div>
      </div>

      {/* Exercise log modal */}
      {selectedExercise && (
        <ExerciseLogModal
          exercise={selectedExercise}
          logs={logs}
          onClose={closeExerciseLog}
          onSaved={handleLogSaved}
          stayOpenOnSave
          prescribedSets={selectedPlanExercise?.prescribedSets || 1}
          prescribedReps={selectedPlanExercise?.prescribedReps || null}
          isExerciseDone={completedExerciseIds.includes(selectedExercise.id)}
          onCompletionChange={(done) => handleExerciseCompletion(selectedExercise.id, done)}
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

      {showWorkoutMenu && (
        <div className="aw-menu-overlay" onClick={() => setShowWorkoutMenu(false)}>
          <div
            className="aw-workout-menu"
            role="dialog"
            aria-modal="true"
            aria-labelledby="aw-workout-menu-title"
            onClick={(event) => event.stopPropagation()}
          >
            <h3 id="aw-workout-menu-title">Workout menu</h3>
            <button
              className="aw-workout-menu__end"
              onClick={() => {
                setShowWorkoutMenu(false);
                setShowEndConfirm(true);
              }}
            >
              End workout
            </button>
            <button
              className="aw-workout-menu__cancel"
              onClick={() => setShowWorkoutMenu(false)}
            >
              Keep going
            </button>
          </div>
        </div>
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
            {completedCount < totalExercises && (
              <p className="aw-end-confirm__note">
                {totalExercises - completedCount} exercises not logged — they'll stay in the plan.
              </p>
            )}
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
