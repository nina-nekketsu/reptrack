import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ExerciseLogModal from '../components/ExerciseLogModal';
import WorkoutSummary from '../components/WorkoutSummary';
import Dialog from '../components/ui/Dialog';
import {
  BoltIcon,
  CheckIcon,
  DumbbellIcon,
  RepeatIcon,
  TimerIcon,
  TrophyIcon,
  TrendIcon,
} from '../components/icons';
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
  getExerciseProgressState,
  getNextIncompleteIndex,
  getRestRecommendation,
} from '../utils/workoutProgress';
import { deriveExerciseDraftProgress } from '../utils/exerciseDraftProgress';
import './Page.css';
import './Exercises.css';
import './Workouts.css';
import './ActiveWorkout.css';
import '../components/CoachComponents.css';

const GROUP_ICONS = {
  Chest: DumbbellIcon,
  Back: RepeatIcon,
  Legs: TrendIcon,
  Shoulders: TrophyIcon,
  Arms: DumbbellIcon,
  Core: TimerIcon,
  default: BoltIcon,
};

function MuscleGroupIcon({ muscleGroup }) {
  const Icon = GROUP_ICONS[muscleGroup] || GROUP_ICONS.default;
  return <Icon />;
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
  const [draftProgressByExerciseId, setDraftProgressByExerciseId] = useState({});
  const [completedExerciseIds, setCompletedExerciseIds] = useState(
    () => getStoredVisibleActiveWorkoutSession()?.completedExerciseIds || []
  );
  const [showSummary, setShowSummary] = useState(false);
  const [summaryData, setSummaryData] = useState(null);
  const [warmupDismissed, setWarmupDismissed] = useState(false);
  const [showWorkoutMenu, setShowWorkoutMenu] = useState(false);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [isEnding, setIsEnding] = useState(false);
  const [completionAnnouncement, setCompletionAnnouncement] = useState('');
  const [acknowledgedExerciseId, setAcknowledgedExerciseId] = useState(null);
  const startedCoachSessionRef = useRef(null);
  const endingRef = useRef(false);
  const workoutEndedRef = useRef(false);
  const completedExerciseIdsRef = useRef(completedExerciseIds);
  completedExerciseIdsRef.current = completedExerciseIds;

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
    if (workoutEndedRef.current) return;

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
      completedExerciseIdsRef.current = session.completedExerciseIds || [];
      setCompletedExerciseIds(completedExerciseIdsRef.current);
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

  function getPersistedExerciseProgress(exerciseId, prescribedSets) {
    const fallback = {
      completedPrimarySets: 0,
      targetPrimarySets: prescribedSets || 1,
    };
    if (!activeSession) return fallback;
    const sessions = logs[exerciseId];
    if (!sessions || sessions.length === 0) return fallback;
    const sessionStart = new Date(activeSession.startedAt).getTime();
    const latestSession = sessions
      .filter((session) => new Date(session.workoutSessionStartedAt || session.date).getTime() >= sessionStart)
      .sort((a, b) => (
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ))[0];
    if (!latestSession) return fallback;
    return deriveExerciseDraftProgress({
      exerciseId,
      rows: latestSession.sets || [],
      prescribedSets,
    });
  }

  const exerciseProgress = plan
    ? plan.exercises.map((planExercise, index) => {
        const exercise = getExercise(planExercise.exerciseId);
        const prescribedTarget = planExercise.prescribedSets || 1;
        const persistedProgress = getPersistedExerciseProgress(
          planExercise.exerciseId,
          prescribedTarget
        );
        const draftProgress = selectedExercise?.id === planExercise.exerciseId
          ? draftProgressByExerciseId[planExercise.exerciseId]
          : null;
        const setsLogged = draftProgress?.completedPrimarySets
          ?? persistedProgress.completedPrimarySets;
        const targetSets = draftProgress?.targetPrimarySets
          ?? persistedProgress.targetPrimarySets;
        const persistedDone = completedExerciseIds.includes(planExercise.exerciseId)
          || (
            persistedProgress.targetPrimarySets > 0
            && persistedProgress.completedPrimarySets >= persistedProgress.targetPrimarySets
          );
        const done = draftProgress
          ? persistedDone && draftProgress.isExplicitlyComplete
          : persistedDone;
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
  const progressScale = totalExercises > 0 ? completedCount / totalExercises : 0;

  function getCompletionAnnouncement(nextCompletedExerciseIds) {
    const projectedProgress = plan.exercises.map((planExercise) => {
      const exercise = getExercise(planExercise.exerciseId);
      const persistedProgress = getPersistedExerciseProgress(
        planExercise.exerciseId,
        planExercise.prescribedSets || 1
      );
      const done = nextCompletedExerciseIds.includes(planExercise.exerciseId)
        || (
          persistedProgress.targetPrimarySets > 0
          && persistedProgress.completedPrimarySets >= persistedProgress.targetPrimarySets
        );
      return { done, exercise };
    });
    const projectedCompletedCount = projectedProgress.filter(({ done }) => done).length;

    if (projectedCompletedCount === projectedProgress.length && projectedProgress.length > 0) {
      return 'Exercise complete. All exercises complete.';
    }

    const projectedNextIndex = getNextIncompleteIndex(
      projectedProgress.map(({ done, exercise }) => done || !exercise)
    );
    const projectedNext = projectedNextIndex >= 0
      ? projectedProgress[projectedNextIndex].exercise
      : null;

    return projectedNext
      ? `Exercise complete. Next: ${projectedNext.name}`
      : 'Exercise complete.';
  }

  function releaseEndAction() {
    endingRef.current = false;
    setIsEnding(false);
  }

  function handleEndWorkout() {
    if (endingRef.current) return;
    endingRef.current = true;
    setIsEnding(true);

    let summary = null;
    let coachMetadataPatch = null;

    // Prepare the summary without mutating state. The local ended tombstone must
    // succeed before timers, coach state, remote sync, or navigation change.
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
        summary = generateSessionSummary(exerciseResults, duration, coach.profile.goal);
        const fatigueAdj = calculateFatigueAdjustment(exerciseResults.map(r => r.overload));
        coachMetadataPatch = {
          fatigueScore: Math.max(0, Math.min(100, coach.metadata.fatigueScore + fatigueAdj)),
          totalSessions: coach.metadata.totalSessions + 1,
          lastSessionDate: new Date().toISOString(),
        };
      }
    }

    try {
      const endedSession = saveActiveWorkoutSession({ action: 'end', now: new Date().toISOString() });
      if (!endedSession) {
        releaseEndAction();
        return;
      }

      timer.stopAll();
      Promise.resolve(endCoachWorkout(activeSession, {
        status: 'ended',
        completedExerciseIds,
      })).catch((error) => {
        console.warn('[coach] cloud workout end failed:', error);
      });
      if (coachMetadataPatch) coach.updateMetadata(coachMetadataPatch);
      coach.deactivateCoach();
      pushActiveWorkoutSession(user?.id);
      workoutEndedRef.current = true;
      setActiveSession(null);
      setShowEndConfirm(false);

      if (summary) {
        setSummaryData(summary);
        setShowSummary(true);
        return;
      }
      navigate('/workouts', { replace: true });
    } catch {
      releaseEndAction();
    }
  }

  function handleCloseSummary() {
    setShowSummary(false);
    setSummaryData(null);
    navigate('/workouts', { replace: true });
  }

  function clearDraftProgress(exerciseId) {
    setDraftProgressByExerciseId((current) => {
      if (!current[exerciseId]) return current;
      const next = { ...current };
      delete next[exerciseId];
      return next;
    });
  }

  function handleLogSaved(exerciseId, updatedLogs) {
    setLogs(updatedLogs);
    clearDraftProgress(exerciseId);
  }

  function handleDraftProgressChange(progress) {
    if (!progress?.exerciseId || progress.exerciseId !== selectedExercise?.id) return;
    setDraftProgressByExerciseId((current) => ({
      ...current,
      [progress.exerciseId]: progress,
    }));
  }

  function openExerciseLog(exercise, planExercise) {
    setSelectedExercise(exercise);
    setSelectedPlanExercise(planExercise);
  }

  function closeExerciseLog() {
    if (selectedExercise?.id) clearDraftProgress(selectedExercise.id);
    setSelectedExercise(null);
    setSelectedPlanExercise(null);
  }

  function handleExerciseCompletion(exerciseId, done) {
    const current = completedExerciseIdsRef.current;
    const isAlreadyComplete = current.includes(exerciseId);
    if (done === isAlreadyComplete) return;

    const next = done
      ? [...new Set([...current, exerciseId])]
      : current.filter((id) => id !== exerciseId);
    const updatedSession = saveActiveWorkoutSession({
      action: 'update',
      patch: { completedExerciseIds: next },
      now: new Date().toISOString(),
    });
    if (!updatedSession) return;

    completedExerciseIdsRef.current = next;
    setCompletedExerciseIds(next);
    setActiveSession(updatedSession);
    if (done) {
      setAcknowledgedExerciseId(exerciseId);
      setCompletionAnnouncement(getCompletionAnnouncement(next));
    } else {
      setAcknowledgedExerciseId(null);
      setCompletionAnnouncement('');
    }
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
            <span className="aw-stat__icon"><TimerIcon /></span>
            <span className="aw-stat__value">{elapsed}</span>
            <span className="aw-stat__label">Elapsed</span>
          </div>
          <div className="aw-stat">
            <span className="aw-stat__icon"><CheckIcon /></span>
            <span className="aw-stat__value">{completedCount}/{totalExercises}</span>
            <span className="aw-stat__label">Exercises</span>
          </div>
        </div>

        {/* Progress bar */}
        <div
          className="aw-progress-bar"
          role="progressbar"
          aria-label="Workout completion"
          aria-valuenow={completedCount}
          aria-valuemin={0}
          aria-valuemax={totalExercises}
          aria-valuetext={`${completedCount} of ${totalExercises} exercises complete`}
        >
          <span
            className="aw-progress-bar__fill"
            style={{ transform: `scaleX(${progressScale})` }}
            aria-hidden="true"
          />
        </div>
      </div>

      {completionAnnouncement && (
        <p className="sr-only" role="status" aria-live="polite">
          {completionAnnouncement}
        </p>
      )}

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

          const showProgressBadge = progressState !== 'idle' && !done;
          const isNext = i === nextExerciseIndex;

          return (
            <div
              key={`${planEx.exerciseId}-${i}`}
              className={`aw-exercise-row aw-exercise-row--${progressState} ${planEx.superset ? 'aw-exercise-row--superset' : ''} ${isNext ? 'aw-exercise-row--next' : ''} ${acknowledgedExerciseId === planEx.exerciseId ? 'aw-exercise-row--ack' : ''}`}
              onClick={() => openExerciseLog(ex, planEx)}
            >
              <span className="aw-exercise-next-outline" aria-hidden="true" />
              <div className="aw-exercise-status">
                {done ? (
                  <span className="aw-check" aria-label={`${ex.name} completed`}><CheckIcon /></span>
                ) : (
                  <span className="aw-number">{i + 1}</span>
                )}
              </div>

              <div className="aw-exercise-thumb">
                <MuscleGroupIcon muscleGroup={ex.muscleGroup} />
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
                ) : showProgressBadge ? (
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
          <span className="aw-complete-icon"><TrophyIcon /></span>
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
          onSaved={(updatedLogs) => handleLogSaved(selectedExercise.id, updatedLogs)}
          onDraftProgressChange={handleDraftProgressChange}
          stayOpenOnSave
          prescribedSets={selectedPlanExercise?.prescribedSets || 1}
          prescribedReps={selectedPlanExercise?.prescribedReps || null}
          isExerciseDone={exerciseProgress.find(
            ({ planExercise }) => planExercise.exerciseId === selectedExercise.id
          )?.done === true}
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

      <Dialog
        open={showWorkoutMenu}
        onClose={() => setShowWorkoutMenu(false)}
        title="Workout menu"
        className="aw-menu-overlay"
        panelClassName="aw-workout-menu"
        labelledBy="aw-workout-menu-title"
        renderHeader={false}
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
      </Dialog>

      {/* End workout confirmation overlay */}
      <Dialog
        open={showEndConfirm}
        onClose={() => {
          if (!endingRef.current) setShowEndConfirm(false);
        }}
        title="End Workout?"
        className="aw-end-overlay"
        panelClassName="aw-end-confirm"
        labelledBy="aw-end-confirm-title"
        renderHeader={false}
      >
            <div className="aw-end-confirm__check"><CheckIcon /></div>
            <h3 id="aw-end-confirm-title" className="aw-end-confirm__title">End Workout?</h3>
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
                disabled={isEnding}
              >
                Keep Going
              </button>
              <button
                className="aw-end-confirm__btn aw-end-confirm__btn--confirm"
                onClick={handleEndWorkout}
                disabled={isEnding}
                aria-busy={isEnding}
              >
                {isEnding ? 'Ending…' : 'End & Save'}
              </button>
            </div>
      </Dialog>
    </div>
  );
}
