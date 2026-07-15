import React, { useEffect, useRef, useState, useMemo } from 'react';
import SetTimer from './SetTimer';
import RecordBadges from './RecordBadges';
import VolumeGraph from './VolumeGraph';
import CoachFeedback from './CoachFeedback';
import RestAdvisor from './RestAdvisor';
import { formatBuildId } from '../utils/buildInfo';
import {
  calcTotals,
  bestSet,
  deleteSession,
  getRecords,
  getSessionRepFeedback,
  getSessionsAsc,
  getSessionsDesc,
  loadLogs,
  saveLogs,
  upsertSession,
} from '../utils/exerciseHelpers';
import { updateRemoteSession } from '../lib/sync';
import { getStoredVisibleActiveWorkoutSession } from '../lib/activeWorkoutSession';
import { useAuth } from '../context/AuthContext';
import { useCoach } from '../context/CoachContext';
import { getPreviousSets, isIntensityAllowed } from '../lib/coachEngine';
import { ensureSetIdentity, getSetFingerprint, normalizeSetIdentities } from '../utils/setIdentity';
import './CoachComponents.css';

const EMPTY_SET_ROW = { reps: '', weight: '', setType: 'normal', done: false };
const DROPSET_CHILD_COUNT = 2;

export function isDropsetChild(set = {}) {
  return set.dropSetChild === true || set.setType === 'dropset_child';
}

export function roundDropsetWeight(weight) {
  const numericWeight = Number(weight);
  if (!Number.isFinite(numericWeight) || numericWeight <= 0) return '';
  return String(Math.round(numericWeight * 0.7));
}

export function createDropsetChildRows(parentWeight) {
  const children = [];
  let previousWeight = parentWeight;
  for (let i = 0; i < DROPSET_CHILD_COUNT; i += 1) {
    const weight = roundDropsetWeight(previousWeight);
    children.push(ensureSetIdentity({
      reps: '',
      weight,
      setType: 'dropset_child',
      dropSetChild: true,
      done: false,
    }, i));
    previousWeight = weight;
  }
  return children;
}

function emptySetRow() {
  return ensureSetIdentity({ ...EMPTY_SET_ROW });
}

export function normalizeSetRow(set = {}, { resetDone = false } = {}) {
  const setType = set.setType || (set.dropSetChild ? 'dropset_child' : 'normal');
  return {
    clientSetId: set.clientSetId,
    setIndex: set.setIndex,
    reps: set.reps?.toString() ?? '',
    weight: set.weight?.toString() ?? '',
    setType,
    ...(setType === 'dropset_child' ? { dropSetChild: true } : {}),
    done: resetDone ? false : Boolean(set.done),
  };
}

export function withTrailingEmptyRow(rows = [], options = {}) {
  const normalized = normalizeSetIdentities(rows.map((row) => normalizeSetRow(row, options)));
  const lastRow = normalized[normalized.length - 1];
  const needsBlankRow = !lastRow || lastRow.reps !== '' || lastRow.weight !== '' || lastRow.setType !== 'normal';
  if (needsBlankRow) return [...normalized, emptySetRow()];
  return [...normalized.slice(0, -1), { ...lastRow, done: false }];
}

function isMeaningfulSet(set = {}) {
  return Number(set.reps) > 0 || Number(set.weight) > 0;
}

function isParentDropset(set = {}) {
  return set.setType === 'dropset' && !isDropsetChild(set);
}

function countFullSets(rows = []) {
  return rows.filter((row) => !isDropsetChild(row) && isMeaningfulSet(row)).length;
}

function getSetLabel(rows, index) {
  const row = rows[index];
  const fullSetNumber = rows.slice(0, index + 1).filter((set) => !isDropsetChild(set)).length;
  if (!isDropsetChild(row)) return fullSetNumber;
  let childNumber = 1;
  for (let i = index - 1; i >= 0; i -= 1) {
    if (!isDropsetChild(rows[i])) break;
    childNumber += 1;
  }
  return `${fullSetNumber}↓${childNumber}`;
}

function removeDropsetChildrenAfter(rows, parentIndex) {
  const next = [...rows];
  let removeCount = 0;
  for (let i = parentIndex + 1; i < next.length && isDropsetChild(next[i]); i += 1) {
    removeCount += 1;
  }
  if (removeCount > 0) next.splice(parentIndex + 1, removeCount);
  return next;
}

function ensureDropsetChildren(rows, parentIndex) {
  const withoutChildren = removeDropsetChildrenAfter(rows, parentIndex);
  const children = createDropsetChildRows(withoutChildren[parentIndex]?.weight);
  return [
    ...withoutChildren.slice(0, parentIndex + 1),
    ...children,
    ...withoutChildren.slice(parentIndex + 1),
  ];
}

function refreshDropsetChildren(rows, parentIndex) {
  const parent = rows[parentIndex];
  if (!isParentDropset(parent)) return rows;
  const next = [...rows];
  let previousWeight = parent.weight;
  for (let i = parentIndex + 1; i < next.length && isDropsetChild(next[i]); i += 1) {
    if (next[i].reps === '') {
      const weight = roundDropsetWeight(previousWeight);
      next[i] = { ...next[i], weight };
      previousWeight = weight;
    } else {
      previousWeight = next[i].weight;
    }
  }
  return next;
}

export function applySetUpdate(rows, index, field, value) {
  const next = [...rows];
  const current = next[index];
  if (!current) return rows;
  if (field === 'setType') {
    if (isDropsetChild(current)) return rows;
    next[index] = { ...current, setType: value };
    return value === 'dropset'
      ? ensureDropsetChildren(next, index)
      : removeDropsetChildrenAfter(next, index);
  }
  next[index] = { ...current, [field]: value };
  return field === 'weight' ? refreshDropsetChildren(next, index) : next;
}

/**
 * Full exercise logging modal — used by both Exercises page and ActiveWorkout page.
 *
 * Props:
 *   exercise   — { id, name, muscleGroup, ... }
 *   onClose    — callback when modal is dismissed
 *   onSaved    — callback after a session is saved (receives updated logs)
 *   logs       — current logs object (from parent state)
 */
export default function ExerciseLogModal({
  exercise,
  onClose,
  onSaved,
  logs,
  stayOpenOnSave = false,
  isExerciseDone = false,
  onCompletionChange,
  prescribedSets = null,
  prescribedReps = null,
}) {
  const { user } = useAuth();
  const coach = useCoach();

  const [activeTab, setActiveTab] = useState('log'); // 'log' | 'overview'
  const [sets, setSets] = useState([emptySetRow()]);
  const [editingSession, setEditingSession] = useState(null);
  const [confirmDeleteDate, setConfirmDeleteDate] = useState(null);
  const [intensity, setIntensity] = useState('moderate');
  const [rir, setRir] = useState('');
  const [lastSavedSet, setLastSavedSet] = useState(null);
  const [lastSavedCoachContext, setLastSavedCoachContext] = useState(null);
  const [savedSetFeedback, setSavedSetFeedback] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const logScrollRef = useRef(null);
  const mountedRef = useRef(true);

  useEffect(() => () => {
    mountedRef.current = false;
  }, []);

  // Coach-related derived data
  const isCoachActive = coach.isOnboarded && coach.coachActive;
  const previousSets = useMemo(
    () => exercise?.id ? getPreviousSets(exercise.id) : [],
    [exercise?.id]
  );

  // When opening an exercise, pre-populate sets if already logged in the current active workout session
  useEffect(() => {
    logScrollRef.current?.scrollTo({ top: 0 });
    setActiveTab('log');
    setEditingSession(null);
    setSavedSetFeedback([]);
    setLastSavedCoachContext(null);

    // Check if this exercise was already logged during the current active workout session
    let initialSets = [emptySetRow()];
    let foundCurrentSession = false;
    try {
      const currentLogs = loadLogs();
      const exerciseSessions = exercise?.id ? (currentLogs[exercise.id] || []) : [];
      const activeWorkoutSession = getStoredVisibleActiveWorkoutSession();
      if (activeWorkoutSession && exercise?.id) {
        const sessionStart = activeWorkoutSession.startedAt
          ? new Date(activeWorkoutSession.startedAt)
          : null;
        if (sessionStart) {

          // Find sessions logged after the workout started (most recent first)
          const sessionsDuringWorkout = exerciseSessions
            .filter((s) => new Date(s.workoutSessionStartedAt || s.date) >= sessionStart)
            .sort((a, b) => new Date(b.date) - new Date(a.date));
          if (sessionsDuringWorkout.length > 0) {
            // Reopen the current workout's latest log in edit mode so saving
            // updates it instead of duplicating volume and remote rows.
            const latestSession = sessionsDuringWorkout[0];
            foundCurrentSession = true;
            initialSets = withTrailingEmptyRow(latestSession.sets || []);
            setEditingSession({ ...latestSession });
            setSavedSetFeedback(getSessionRepFeedback(currentLogs, exercise.id, latestSession));
          }
        }
      }

      if (!foundCurrentSession && exerciseSessions.length > 0) {
        const latestPrevious = [...exerciseSessions]
          .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        initialSets = withTrailingEmptyRow(latestPrevious.sets || [], { resetDone: true });
      }
    } catch (e) {
      // Fall back to empty row if anything goes wrong
    }

    const hasPrefilledValues = initialSets.some((set) => isMeaningfulSet(set));
    if (!foundCurrentSession && !hasPrefilledValues && Number(prescribedSets) > 0) {
      initialSets = Array.from(
        { length: Number(prescribedSets) },
        () => emptySetRow()
      );
    }

    setSets(initialSets);
  }, [exercise?.id, prescribedSets]);

  const editingDateLabel = editingSession
    ? new Date(editingSession.date).toLocaleDateString('nl-NL', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  function updateSet(index, field, value) {
    setSavedSetFeedback([]);
    setSets((prev) => applySetUpdate(prev, index, field, value));
  }

  function addSet() {
    setSavedSetFeedback([]);
    setSets((prev) => [...prev, emptySetRow()]);
  }

  function removeSet(index) {
    setSavedSetFeedback([]);
    setSets((prev) => {
      const target = prev[index];
      if (!target) return prev;
      let next = isParentDropset(target)
        ? removeDropsetChildrenAfter(prev, index)
        : [...prev];
      next = next.filter((_, i) => i !== index);
      return next.length > 0 ? next : [emptySetRow()];
    });
  }

  function scrollToTop() {
    logScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function closeModal() {
    setEditingSession(null);
    setSets([emptySetRow()]);
    setActiveTab('log');
    setSavedSetFeedback([]);
    setLastSavedCoachContext(null);
    onClose();
  }

  function handleBackToLog() {
    setActiveTab('log');
    scrollToTop();
  }

  function handleEditSession(session) {
    const normalizedSets = withTrailingEmptyRow(session.sets || []);
    setSets(normalizedSets);
    setEditingSession({ ...session });
    setSavedSetFeedback(getSessionRepFeedback(logs, exercise.id, session));
    setActiveTab('log');
    scrollToTop();
  }

  function handleLogAsNewSession() {
    setEditingSession(null);
    setSets([emptySetRow()]);
    setSavedSetFeedback([]);
    scrollToTop();
  }

  function handleRequestDelete(sessionDate) {
    setConfirmDeleteDate(sessionDate);
  }

  function handleCancelDelete() {
    setConfirmDeleteDate(null);
  }

  function handleConfirmDelete() {
    if (!confirmDeleteDate) return;
    const updatedLogs = deleteSession(exercise.id, confirmDeleteDate, user?.id);
    setConfirmDeleteDate(null);
    if (editingSession?.date === confirmDeleteDate) {
      setEditingSession(null);
      setSets([emptySetRow()]);
    }
    window.dispatchEvent(new Event('exerciseLogged'));
    if (onSaved) onSaved(updatedLogs);
  }

  async function saveSession() {
    if (isSaving) return;
    const validSets = sets.filter((s) => s.reps !== '' || s.weight !== '');
    if (validSets.length === 0) return;

    // Preserve stable set identity across local edits, remote upserts, and coach messages.
    const enrichedSets = normalizeSetIdentities(validSets).map((set, index) => {
      const identified = ensureSetIdentity({ ...set, setIndex: index }, index);
      const enriched = isCoachActive
        ? { ...identified, intensity, rir: rir !== '' ? Number(rir) : undefined }
        : identified;
      return { ...enriched, setFingerprint: getSetFingerprint(enriched) };
    });

    const best = bestSet(enrichedSets);
    const activeWorkoutSession = getStoredVisibleActiveWorkoutSession();
    const baseSession = {
      sets: enrichedSets,
      bestSet: best,
      ...calcTotals(enrichedSets),
      ...(activeWorkoutSession?.startedAt
        ? { workoutSessionStartedAt: activeWorkoutSession.startedAt }
        : {}),
    };

    // Track last saved set for coach feedback
    if (isCoachActive && enrichedSets.length > 0) {
      setLastSavedSet(enrichedSets[enrichedSets.length - 1]);
    }

    const currentLogs = loadLogs();
    const existingSessions = currentLogs[exercise.id] || [];
    let updatedLogs;
    let persistedSession;

    if (editingSession) {
      persistedSession = {
        ...editingSession,
        ...baseSession,
        date: editingSession.date,
      };
      updatedLogs = {
        ...currentLogs,
        [exercise.id]: existingSessions.map((session) =>
          session.date === editingSession.date ? persistedSession : session
        ),
      };
    } else {
      persistedSession = {
        date: new Date().toISOString(),
        ...baseSession,
      };
      updatedLogs = {
        ...currentLogs,
        [exercise.id]: [...existingSessions, persistedSession],
      };
    }

    // Local-first: make the completed set/session durable before waiting on the network.
    saveLogs(updatedLogs);
    window.dispatchEvent(new Event('exerciseLogged'));
    if (onSaved) onSaved(updatedLogs);
    const meaningfulParentSets = enrichedSets.filter(
      (set) => !isDropsetChild(set) && isMeaningfulSet(set)
    );
    const completedAfterSave = meaningfulParentSets.length > 0
      && meaningfulParentSets.every((set) => set.done === true);
    if (onCompletionChange) onCompletionChange(completedAfterSave);

    const syncPromise = user
      ? persistedSession.remoteId
        ? updateRemoteSession(persistedSession.remoteId, exercise.id, persistedSession, user.id)
        : upsertSession(exercise.id, persistedSession, user.id)
      : null;

    const setCoachContextForSession = (exerciseLogId) => {
      if (!mountedRef.current || !exerciseLogId || persistedSession.sets.length === 0) return;
      const setIndex = persistedSession.sets.length - 1;
      const lastSet = persistedSession.sets[setIndex];
      setLastSavedCoachContext({
        exerciseLogId,
        exerciseId: exercise.id,
        setIndex,
        clientSetId: lastSet?.clientSetId,
        setFingerprint: lastSet?.setFingerprint || getSetFingerprint(lastSet),
        localStartedAt: persistedSession.workoutSessionStartedAt || persistedSession.date,
      });
    };

    setCoachContextForSession(persistedSession.remoteId);

    const persistReturnedRemoteId = (remoteId) => {
      if (persistedSession.remoteId || typeof remoteId !== 'string' || !remoteId) {
        return false;
      }
      persistedSession = { ...persistedSession, remoteId };
      const latestLogs = loadLogs();
      updatedLogs = {
        ...latestLogs,
        [exercise.id]: (latestLogs[exercise.id] || []).map((session) =>
          session.date === persistedSession.date ? { ...session, remoteId } : session
        ),
      };
      saveLogs(updatedLogs);
      window.dispatchEvent(new Event('exerciseLogged'));
      setCoachContextForSession(remoteId);
      return true;
    };

    if (stayOpenOnSave) {
      // Commit the local UI state immediately. Remote latency must not rehydrate over
      // edits the user makes while the insert is in flight.
      setEditingSession({ ...persistedSession });
      setSets(withTrailingEmptyRow(persistedSession.sets));
      setSavedSetFeedback(getSessionRepFeedback(updatedLogs, exercise.id, persistedSession));
      setActiveTab('log');
      scrollToTop();

      if (syncPromise) {
        setIsSaving(true);
        try {
          const remoteResult = await syncPromise;
          const attachedRemoteId = persistReturnedRemoteId(remoteResult);
          if (attachedRemoteId && mountedRef.current) {
            setEditingSession((current) =>
              current?.date === persistedSession.date
                ? { ...current, remoteId: persistedSession.remoteId }
                : current
            );
            if (onSaved) onSaved(updatedLogs);
          }
        } catch (err) {
          console.warn('[Supabase] session sync failed:', err);
        } finally {
          if (mountedRef.current) setIsSaving(false);
        }
      }
      return;
    }

    if (syncPromise) {
      syncPromise
        .then((remoteResult) => persistReturnedRemoteId(remoteResult))
        .catch((err) =>
          console.warn('[Supabase] session sync failed:', err)
        );
    }
    closeModal();
  }

  // ── Derived data for Overview tab ──
  const sessionsDesc = getSessionsDesc(logs, exercise.id);
  const sessionsAsc = getSessionsAsc(logs, exercise.id);
  const hasHistory = sessionsDesc.length > 0;
  const records = getRecords(sessionsDesc);
  const liveTotals = calcTotals(sets);
  const completedSetCount = sets.filter(
    (set) => !isDropsetChild(set) && isMeaningfulSet(set) && set.done
  ).length;
  const completionTarget = Math.max(1, Number(prescribedSets) || countFullSets(sets) || 1);

  const lastSession = sessionsDesc[0] || null;
  const last5 = sessionsDesc.slice(0, 5);

  return (
    <div className="modal-overlay" onClick={closeModal}>
      <div className="modal modal--log" role="dialog" aria-modal="true" aria-labelledby="exercise-log-title" onClick={(e) => e.stopPropagation()}>
        <div className="log-sticky-top">
          <div id="log-timer-top" className="log-timer-zone">
            <div className="log-header-text">
              <div className="log-header-title-row">
                <h3 className="modal-title" id="exercise-log-title">{exercise.name}</h3>
                <span className="build-id-tag build-id-tag--modal">{formatBuildId()}</span>
              </div>
              <p className="modal-sub">{exercise.muscleGroup} · Log your sets</p>
            </div>

            <SetTimer exerciseId={exercise.id} />
          </div>
          <div className="log-tabs-wrapper">
            <div className="log-tabs" role="tablist" aria-label="Exercise tabs">
              <button
                type="button"
                className={`log-tab ${activeTab === 'log' ? 'active' : ''}`}
                onClick={() => setActiveTab('log')}
                role="tab"
                aria-selected={activeTab === 'log'}
              >
                Log
              </button>
              <button
                type="button"
                className={`log-tab ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
                role="tab"
                aria-selected={activeTab === 'overview'}
              >
                Overview
              </button>
            </div>
          </div>
        </div>

        <div className="log-scroll-body" ref={logScrollRef}>
          {activeTab === 'log' ? (
            <>
              <div className="modal-divider" />

              {editingSession && (
                <div className="editing-banner">
                  <span>Editing session: {editingDateLabel}</span>
                  <button type="button" className="editing-banner__new" onClick={handleLogAsNewSession}>
                    Log as new session
                  </button>
                </div>
              )}

              <div className="sets-header">
                <span>Set</span>
                <span>Reps</span>
                <span>Weight (kg)</span>
                <span>Type</span>
                <span className="sets-header__icon" aria-label="Done">✓</span>
                <span></span>
              </div>

              {sets.map((s, i) => {
                const feedback = savedSetFeedback[i] || null;
                const feedbackId = feedback ? `set-feedback-${i}` : undefined;
                const childRow = isDropsetChild(s);
                const meaningful = isMeaningfulSet(s);
                return (
                  <React.Fragment key={s.clientSetId || i}>
                    <div className={`set-row ${feedback ? `set-row--${feedback.state}` : ''} ${isParentDropset(s) ? 'set-row--dropset' : ''} ${childRow ? 'set-row--dropset-child' : ''}`}>
                      <span className={`set-num ${childRow ? 'set-num--dropset-child' : ''}`}>{getSetLabel(sets, i)}</span>
                      <input className={`set-input ${feedback ? `set-input--${feedback.state}` : ''}`} type="number" inputMode="numeric" min="0" placeholder="0" value={s.reps} onChange={(e) => updateSet(i, 'reps', e.target.value)} aria-label={`Set ${i + 1} reps`} aria-describedby={feedbackId} />
                      <input className={`set-input ${feedback ? `set-input--${feedback.state}` : ''}`} type="number" inputMode="decimal" min="0" step="0.5" placeholder="0" value={s.weight} onChange={(e) => updateSet(i, 'weight', e.target.value)} aria-label={`Set ${i + 1} weight`} aria-describedby={feedbackId} />
                      {childRow ? (
                        <span className="set-input set-type-child" title="Dropset child">↳</span>
                      ) : (
                        <select
                          className="set-input"
                          value={s.setType || 'normal'}
                          onChange={(e) => updateSet(i, 'setType', e.target.value)}
                          aria-label={`Set ${getSetLabel(sets, i)} type`}
                        >
                          <option value="normal">N</option>
                          <option value="dropset">D</option>
                        </select>
                      )}
                      <button
                        type="button"
                        className={`set-done-btn ${s.done ? 'set-done-btn--active' : ''}`}
                        onClick={() => updateSet(i, 'done', !s.done)}
                        disabled={childRow || !meaningful}
                        aria-pressed={Boolean(s.done)}
                        aria-label={`Mark set ${getSetLabel(sets, i)} ${s.done ? 'not done' : 'done'}`}
                      >
                        {s.done ? '✓' : '○'}
                      </button>
                      <button className="remove-set-btn" aria-label={`Remove set ${i + 1}`} onClick={() => removeSet(i)} disabled={sets.length === 1}>✕</button>
                    </div>
                    {feedback && (
                      <div id={feedbackId} className={`set-feedback set-feedback--${feedback.state}`} role="status">
                        <span className="set-feedback__icon" aria-hidden="true">{feedback.icon}</span>
                        <span className="set-feedback__text">{feedback.label}</span>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}

              <button className="add-set-btn" onClick={addSet}>
                + Add Set
              </button>

              {(completedSetCount > 0 || isExerciseDone) && (
                <div className="set-completion-summary" role="status">
                  {isExerciseDone
                    ? 'Exercise complete'
                    : `${completedSetCount}/${completionTarget} full sets checked`}
                </div>
              )}

              <div className="live-totals">
                <div className="total-pill">
                  <span className="total-label">Total Reps</span>
                  <span className="total-value">{liveTotals.totalReps}</span>
                </div>
                <div className="total-pill">
                  <span className="total-label">Total Volume</span>
                  <span className="total-value">{liveTotals.totalVolume.toLocaleString()} kg</span>
                </div>
              </div>

              {/* ── Coach: Intensity & RIR ── */}
              {isCoachActive && (
                <>
                  <div className="section-label">Intensity</div>
                  <div className="intensity-row">
                    {['light', 'moderate', 'hard', 'all-out'].map(level => (
                      <button
                        key={level}
                        className={`intensity-chip ${intensity === level ? 'active' : ''}`}
                        onClick={() => setIntensity(level)}
                        disabled={!isIntensityAllowed(level, coach.weeksActive, coach.canUseAllOut)}
                      >
                        {level}
                      </button>
                    ))}
                  </div>
                  <div className="rir-input-row">
                    <span className="rir-label">RIR (reps in reserve):</span>
                    <input
                      className="rir-input"
                      type="number"
                      min="0"
                      max="10"
                      placeholder={coach.targetRIR}
                      value={rir}
                      onChange={e => setRir(e.target.value)}
                    />
                  </div>

                  <RestAdvisor goal={coach.profile.goal} intensity={intensity} />
                </>
              )}

              {/* ── Coach Feedback (after logging) ── */}
              {isCoachActive && lastSavedSet && (
                <CoachFeedback
                  exerciseId={exercise.id}
                  currentSet={lastSavedSet}
                  previousSets={previousSets}
                  goal={coach.profile.goal}
                  targetReps={prescribedReps}
                  encouragementStyle={coach.profile.encouragementStyle}
                  feedbackFrequency={coach.profile.feedbackFrequency}
                  metadata={coach.metadata}
                  aiContext={lastSavedCoachContext}
                />
              )}

              <button className="back-to-top-btn" onClick={scrollToTop} type="button">
                ↑ Back to timer
              </button>
            </>
          ) : (
            <>
              <div className="modal-divider" />

              {!hasHistory && (
                <p className="insights-no-history">
                  📭 No history yet on this device/site — log a session to see your records and graph.
                </p>
              )}

              {hasHistory && (
                <>
                  <div className="section-label">Personal Records</div>
                  <RecordBadges records={records} />
                </>
              )}

              <div className="section-label">Volume Over Time</div>
              <VolumeGraph sessions={sessionsAsc} />

              {hasHistory && lastSession && (
                <>
                  <div className="section-label">Last Session Sets</div>
                  <div className="last-session-sets">
                    <div className="last-session-sets__header">
                      <span className="last-session-sets__title">📋 Last session</span>
                      <span className="last-session-sets__date">
                        {new Date(lastSession.date).toLocaleDateString('nl-NL', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                    <table className="last-session-sets__table">
                      <thead>
                        <tr>
                          <th>Set</th>
                          <th>kg</th>
                          <th>Reps</th>
                        </tr>
                      </thead>
                      <tbody>
                        {lastSession.sets.map((s, idx) => (
                          <tr key={idx}>
                            <td>{idx + 1}</td>
                            <td>{s.weight || '—'}</td>
                            <td>{s.reps || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {hasHistory && (
                <>
                  <div className="section-label">Recent Sessions</div>
                  <div className="history-sessions">
                    {last5.map((session) => (
                      <div className="session-card" key={session.date}>
                        <div className="session-card-header">
                          <div className="session-date">
                            {new Date(session.date).toLocaleDateString('nl-NL', {
                              weekday: 'short',
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </div>
                          <button
                            type="button"
                            className="session-edit-btn"
                            onClick={() => handleEditSession(session)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="session-delete-btn"
                            title="Delete session"
                            aria-label="Delete session"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRequestDelete(session.date);
                            }}
                          >
                            🗑
                          </button>
                        </div>
                        <div className="session-stats">
                          <span>{session.sets.length} sets</span>
                          <span>{session.totalReps} reps</span>
                          <span>{session.totalVolume.toLocaleString()} kg vol</span>
                        </div>
                        <div className="session-sets-detail">
                          {session.sets.map((s, j) => (
                            <span key={j} className="set-pill">
                              {s.reps}×{s.weight}kg
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <button className="btn-secondary" onClick={scrollToTop} type="button">
                Back to top
              </button>
            </>
          )}
        </div>

        <div className="log-actions">
          {activeTab === 'log' ? (
            <>
              <button
                type="button"
                className="btn-primary"
                onClick={saveSession}
                disabled={isSaving || (liveTotals.totalReps === 0 && liveTotals.totalVolume === 0)}
              >
                {isSaving ? 'Saving…' : 'Done'}
              </button>
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Cancel
              </button>
            </>
          ) : (
            <>
              <button type="button" className="btn-secondary" onClick={handleBackToLog}>
                Back to Log
              </button>
              <button type="button" className="btn-secondary" onClick={closeModal}>
                Close
              </button>
            </>
          )}
        </div>
      </div>
      {confirmDeleteDate && (
        <div className="confirm-overlay" onClick={handleCancelDelete}>
          <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
            <div className="confirm-icon">🗑️</div>
            <p className="confirm-message">Delete this session? This cannot be undone.</p>
            <div className="confirm-actions">
              <button className="btn-danger" onClick={handleConfirmDelete}>
                Delete
              </button>
              <button className="btn-secondary" onClick={handleCancelDelete}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
