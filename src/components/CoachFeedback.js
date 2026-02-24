// src/components/CoachFeedback.js — Per-set coaching feedback component
import React, { useMemo } from 'react';
import {
  detectOverload,
  generateCoachMessage,
  getNextSetGuidance,
  getTempoCue,
  suggestOverloadLever,
} from '../lib/coachEngine';

export default function CoachFeedback({
  exerciseId,
  currentSet,
  previousSets,
  goal,
  targetReps,
  encouragementStyle,
  feedbackFrequency,
  metadata,
}) {
  const overload = useMemo(
    () => detectOverload(exerciseId, currentSet, previousSets),
    [exerciseId, currentSet, previousSets]
  );

  if (!currentSet || (!currentSet.reps && !currentSet.weight)) return null;

  const message = generateCoachMessage(overload, encouragementStyle || 'balanced');
  const guidance = getNextSetGuidance(overload, goal, targetReps);
  const tempoCue = getTempoCue(goal);
  const overloadSuggestion = overload.type === 'maintained' || overload.type === 'regressed'
    ? suggestOverloadLever(exerciseId, metadata)
    : null;

  const isMinimal = feedbackFrequency === 'minimal';
  const isDetailed = feedbackFrequency === 'detailed';

  // Status indicator
  const statusClass = {
    improved: 'coach-fb--improved',
    regressed: 'coach-fb--regressed',
    maintained: 'coach-fb--maintained',
    first: 'coach-fb--first',
  }[overload.type] || 'coach-fb--maintained';

  const statusIcon = {
    improved: '+',
    regressed: '-',
    maintained: '=',
    first: '*',
  }[overload.type] || '=';

  return (
    <div className={`coach-feedback ${statusClass}`}>
      <div className="coach-fb-header">
        <span className="coach-fb-status">{statusIcon}</span>
        <span className="coach-fb-message">{message}</span>
      </div>

      {/* Overload lever details */}
      {!isMinimal && overload.levers && overload.levers.length > 0 && (
        <div className="coach-fb-levers">
          {overload.levers.map((l, i) => (
            <span key={i} className={`coach-fb-lever coach-fb-lever--${l.direction}`}>
              {l.lever}: {l.from} {l.direction === 'up' ? '>' : '<'} {l.to}
            </span>
          ))}
        </div>
      )}

      {/* Next set guidance */}
      {!isMinimal && (
        <div className="coach-fb-guidance">{guidance}</div>
      )}

      {/* Overload suggestion for stalled exercises */}
      {!isMinimal && overloadSuggestion && (
        <div className="coach-fb-suggestion">
          Try: {overloadSuggestion.label}
        </div>
      )}

      {/* Detailed: tempo cue */}
      {isDetailed && (
        <div className="coach-fb-tempo">Tempo: {tempoCue}</div>
      )}
    </div>
  );
}
