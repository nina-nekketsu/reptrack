// src/lib/coachEngine.js — Progressive Overload Engine
// Core coaching logic: compares sets to history, detects overload levers,
// generates coaching messages, plateau detection, progression tables.

import { loadLogs } from '../utils/exerciseHelpers';

// ── Rest time recommendations (seconds) — ranges from PRD Section 5.4.8 ──
const REST_TABLE = {
  hypertrophy: {
    light:     { min: 30,  max: 60 },
    moderate:  { min: 60,  max: 120 },
    hard:      { min: 120, max: 240 },
    'all-out': { min: 120, max: 240 },
  },
  strength: {
    light:     { min: 60,  max: 120 },
    moderate:  { min: 120, max: 180 },
    hard:      { min: 180, max: 300 },
    'all-out': { min: 180, max: 300 },
  },
  superset: { min: 15, max: 90 },
};

export function getRecommendedRest(goal, intensity, isSuperset = false) {
  if (isSuperset) return REST_TABLE.superset;
  const table = REST_TABLE[goal] || REST_TABLE.hypertrophy;
  return table[intensity] || table.moderate;
}

// ── Overload detection ──────────────────────────────────────────────────
// Compare a current set to the "best matching" previous set from history.
// Returns an object describing what improved, stayed the same, or regressed.

export function detectOverload(exerciseId, currentSet, previousSets) {
  if (!previousSets || previousSets.length === 0) {
    return { type: 'first', levers: [], message: null };
  }

  const currWeight = Number(currentSet.weight) || 0;
  const currReps = Number(currentSet.reps) || 0;
  const currIntensity = currentSet.intensity || 'moderate';
  const currRIR = currentSet.rir != null ? Number(currentSet.rir) : null;

  // Find the best previous set (by Epley 1RM estimate)
  const prevBest = previousSets.reduce((best, s) => {
    const score = (Number(s.weight) || 0) * (1 + (Number(s.reps) || 0) / 30);
    const bestScore = (Number(best.weight) || 0) * (1 + (Number(best.reps) || 0) / 30);
    return score > bestScore ? s : best;
  }, previousSets[0]);

  const prevWeight = Number(prevBest.weight) || 0;
  const prevReps = Number(prevBest.reps) || 0;
  const prevRIR = prevBest.rir != null ? Number(prevBest.rir) : null;

  const levers = [];

  // Weight improved
  if (currWeight > prevWeight) {
    levers.push({ lever: 'weight', direction: 'up', from: prevWeight, to: currWeight });
  } else if (currWeight < prevWeight) {
    levers.push({ lever: 'weight', direction: 'down', from: prevWeight, to: currWeight });
  }

  // Reps improved
  if (currReps > prevReps) {
    levers.push({ lever: 'reps', direction: 'up', from: prevReps, to: currReps });
  } else if (currReps < prevReps) {
    levers.push({ lever: 'reps', direction: 'down', from: prevReps, to: currReps });
  }

  // RIR decreased (closer to failure = harder = progress)
  if (currRIR !== null && prevRIR !== null) {
    if (currRIR < prevRIR) {
      levers.push({ lever: 'rir', direction: 'up', from: prevRIR, to: currRIR });
    } else if (currRIR > prevRIR) {
      levers.push({ lever: 'rir', direction: 'down', from: prevRIR, to: currRIR });
    }
  }

  // Classify overall
  const improvements = levers.filter(l => l.direction === 'up');
  const regressions = levers.filter(l => l.direction === 'down');

  let type;
  if (improvements.length > 0 && regressions.length === 0) {
    type = 'improved';
  } else if (regressions.length > 0 && improvements.length === 0) {
    type = 'regressed';
  } else if (improvements.length > 0 && regressions.length > 0) {
    // Mixed — e.g. more weight but fewer reps. Check 1RM estimate.
    const curr1RM = currWeight * (1 + currReps / 30);
    const prev1RM = prevWeight * (1 + prevReps / 30);
    type = curr1RM > prev1RM ? 'improved' : curr1RM < prev1RM ? 'regressed' : 'maintained';
  } else {
    type = 'maintained';
  }

  return { type, levers, prevBest, currIntensity };
}

// ── Get previous session's sets for an exercise ─────────────────────────
export function getPreviousSets(exerciseId, beforeDate) {
  const logs = loadLogs();
  const sessions = logs[exerciseId];
  if (!sessions || sessions.length === 0) return [];

  // Sort descending by date
  const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));

  if (beforeDate) {
    const cutoff = new Date(beforeDate).getTime();
    const prev = sorted.find(s => new Date(s.date).getTime() < cutoff);
    return prev ? prev.sets : [];
  }

  return sorted[0]?.sets || [];
}

// ── Coaching message generation ─────────────────────────────────────────
// Key phrases from PRD Section 6.2 woven in contextually:
//   "Harder than last time", "This is a marathon, not a sprint",
//   "Just show up", "There are no rules", "Effort overrides variety",
//   "Train smarter, not just harder", "Zoom out"
const MESSAGES = {
  improved: {
    soft: [
      'Nice work! You improved — that\'s what matters.',
      'Great effort, keep it up! Consistency is paying off.',
      'You\'re making progress! This is why showing up matters.',
    ],
    balanced: [
      'Harder than last time. That\'s the goal, every session.',
      'Better than last time. Effort overrides everything else.',
      'Progress detected. Stay consistent — this is a marathon, not a sprint.',
    ],
    tough: [
      'Good. Harder than last time. Now do it again.',
      'Improvement noted. This is the standard. Maintain it.',
      'That\'s progress. You showed up and delivered.',
    ],
    aggressive: [
      'HARDER THAN LAST TIME. That\'s EXACTLY right!',
      'You showed up and delivered. THAT is how you build a physique.',
      'Progress. Real progress. Effort overrides variety — keep pushing.',
    ],
  },
  maintained: {
    soft: [
      'Consistent performance — that\'s valuable. You showed up.',
      'Same as before, and that\'s okay. This is a marathon, not a sprint.',
      'Staying steady is still showing up. Progress comes in waves.',
    ],
    balanced: [
      'Maintained. Try to push one lever next set — add a rep, slow the tempo.',
      'Holding steady. Zoom out — monthly progress matters more than daily.',
      'Same performance. Can you add a rep or slow the eccentric?',
    ],
    tough: [
      'Same as last time. Harder than last time is the rule. Find a lever.',
      'No improvement. Find a way to progress — reps, tempo, anything.',
      'Maintenance is temporary. You didn\'t show up to stay the same.',
    ],
    aggressive: [
      'Same numbers. HARDER than last time. That\'s the rule. Push.',
      'Where\'s the progress? Add a rep, slow the negative, cut rest. Move.',
      'Not good enough. Effort overrides variety — find a way to improve.',
    ],
  },
  regressed: {
    soft: [
      'A bit below last time. No worries — bad days happen. Just show up.',
      'Slight dip. Focus on form and try again. This is a marathon, not a sprint.',
      'Not every session is a PR. Rest, recover, come back stronger.',
    ],
    balanced: [
      'Below last session. Could be fatigue. Keep the weight, aim for reps.',
      'Regression — it happens. Hold weight steady, rebuild. Zoom out.',
      'Off day. Don\'t drop weight yet. Train smarter, not just harder.',
    ],
    tough: [
      'Down from last time. Check sleep, food, stress. Fix what\'s outside the gym.',
      'Regression. Are you sleeping and eating enough? Be honest with yourself.',
      'Weaker today. It happens. But figure out why — train smarter.',
    ],
    aggressive: [
      'Weaker than last time. Figure out why. Sleep, food, stress — fix it.',
      'Down numbers. This is not acceptable long term. Address recovery NOW.',
      'Not the direction we want. Train smarter, not just harder. Fix the basics.',
    ],
  },
  first: {
    soft: ['First time logging this exercise! Great start. Just showing up is the hardest part.'],
    balanced: ['First set logged. This is your baseline. Now beat it — harder than last time.'],
    tough: ['Baseline set. The only direction from here is up. Beat this next time.'],
    aggressive: ['Starting point locked in. Only up from here. HARDER THAN LAST TIME.'],
  },
};

export function generateCoachMessage(overloadResult, style = 'balanced') {
  const msgs = MESSAGES[overloadResult.type]?.[style] || MESSAGES.maintained.balanced;
  return msgs[Math.floor(Math.random() * msgs.length)];
}

// ── Next set guidance ───────────────────────────────────────────────────
export function getNextSetGuidance(overloadResult, goal, targetReps) {
  const { type, prevBest } = overloadResult;

  if (!prevBest) {
    return `Aim for ${targetReps || '10-12'} reps at a comfortable weight.`;
  }

  const weight = Number(prevBest.weight) || 0;
  const reps = Number(prevBest.reps) || 0;

  switch (type) {
    case 'improved':
      return `Keep ${weight}kg, aim for ${targetReps || `${reps}-${reps + 2}`} reps. You're on track.`;
    case 'maintained':
      if (goal === 'strength') {
        return `Try adding 1-2 reps at ${weight}kg, or add 2.5kg and aim for ${Math.max(reps - 2, 1)} reps.`;
      }
      return `Try one more rep at ${weight}kg, or slow the eccentric for more TUT.`;
    case 'regressed':
      return `Hold at ${weight}kg. Focus on form, aim for ${reps} reps. No shame in rebuilding.`;
    default:
      return `Aim for ${targetReps || '10-12'} reps. Start conservative.`;
  }
}

// ── Overload lever suggestion — all 10 forms from PRD Section 5.4.7 ─────
const OVERLOAD_LEVERS = [
  { lever: 'reps',      label: 'Add 1-2 reps per set' },
  { lever: 'technique', label: 'Improve technique — control every rep' },
  { lever: 'weight',    label: 'Increase weight by 2.5kg' },
  { lever: 'volume',    label: 'Add one more working set' },
  { lever: 'rest',      label: 'Reduce rest time by 15-30s' },
  { lever: 'rir',       label: 'Push closer to failure (lower RIR)' },
  { lever: 'rom',       label: 'Increase range of motion' },
  { lever: 'tempo',     label: 'Slow the eccentric (3s down)' },
  { lever: 'pause',     label: 'Add a pause at peak contraction' },
  { lever: 'partials',  label: 'Add partial reps after failure (advanced)' },
];

export function suggestOverloadLever(exerciseId, metadata) {
  const best = metadata?.bestOverloadLever?.[exerciseId];
  if (best) {
    const found = OVERLOAD_LEVERS.find(l => l.lever === best);
    if (found) return found;
  }
  // Default: try reps first (safest)
  return OVERLOAD_LEVERS[0];
}

// ── Plateau detection ───────────────────────────────────────────────────
// Check if exercise has stalled for 4+ sessions with no improvement
export function detectPlateau(exerciseId) {
  const logs = loadLogs();
  const sessions = logs[exerciseId];
  if (!sessions || sessions.length < 4) return { isPlateau: false, weeks: 0 };

  const sorted = [...sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
  const recent4 = sorted.slice(0, 4);

  // Compare best 1RM estimate across recent 4 sessions
  const estimates = recent4.map(s => {
    if (!s.bestSet) return 0;
    const w = Number(s.bestSet.weight) || 0;
    const r = Number(s.bestSet.reps) || 0;
    return w * (1 + r / 30);
  });

  const maxEstimate = Math.max(...estimates);
  const minEstimate = Math.min(...estimates);

  // If variation is less than 2%, consider it a plateau
  const variation = maxEstimate > 0 ? (maxEstimate - minEstimate) / maxEstimate : 0;
  const isPlateau = variation < 0.02;

  // Calculate weeks span
  const oldest = new Date(recent4[recent4.length - 1].date);
  const newest = new Date(recent4[0].date);
  const weeks = Math.ceil((newest - oldest) / (7 * 24 * 60 * 60 * 1000));

  return { isPlateau, weeks, estimate: maxEstimate };
}

// ── Tempo cue ───────────────────────────────────────────────────────────
export function getTempoCue(goal) {
  if (goal === 'strength') {
    return 'Controlled down, explosive up';
  }
  return '2s down, squeeze at peak, 1s up';
}

// ── Fatigue score update ────────────────────────────────────────────────
// Call at end of session to update fatigue based on performance
export function calculateFatigueAdjustment(sessionOverloads) {
  if (!sessionOverloads || sessionOverloads.length === 0) return 0;

  let delta = 0;
  for (const o of sessionOverloads) {
    if (o.type === 'regressed') delta += 10;
    if (o.type === 'maintained') delta += 2;
    if (o.type === 'improved') delta -= 5;
  }

  return Math.round(delta / sessionOverloads.length);
}

// ── Session summary generation ──────────────────────────────────────────
export function generateSessionSummary(exerciseResults, totalDuration, goal) {
  const improvements = exerciseResults.filter(r => r.overload?.type === 'improved');
  const regressions = exerciseResults.filter(r => r.overload?.type === 'regressed');
  const maintained = exerciseResults.filter(r => r.overload?.type === 'maintained');
  const firstTime = exerciseResults.filter(r => r.overload?.type === 'first');

  const totalSets = exerciseResults.reduce((sum, r) => sum + (r.setsLogged || 0), 0);
  const totalVolume = exerciseResults.reduce((sum, r) => sum + (r.volume || 0), 0);

  return {
    totalSets,
    totalVolume,
    duration: totalDuration,
    improvements: improvements.map(r => ({
      exercise: r.exerciseName,
      levers: r.overload.levers.filter(l => l.direction === 'up'),
    })),
    regressions: regressions.map(r => ({
      exercise: r.exerciseName,
      levers: r.overload.levers.filter(l => l.direction === 'down'),
    })),
    maintainedCount: maintained.length,
    firstTimeCount: firstTime.length,
    exerciseCount: exerciseResults.length,
  };
}

// ── Intensity guardrails ────────────────────────────────────────────────
export function isIntensityAllowed(intensity, weeksActive, canUseAllOut) {
  if (intensity === 'all-out') {
    return canUseAllOut && weeksActive >= 4;
  }
  return true;
}

// ── Format rest time ────────────────────────────────────────────────────
export function formatRestTime(restRange) {
  if (typeof restRange === 'number') {
    const m = Math.floor(restRange / 60);
    const s = restRange % 60;
    return s === 0 ? `${m} min` : `${m}:${String(s).padStart(2, '0')}`;
  }
  // Range object { min, max }
  const fmtSingle = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return s === 0 ? `${m}` : `${m}:${String(s).padStart(2, '0')}`;
  };
  if (restRange.min === restRange.max) return `${fmtSingle(restRange.min)} min`;
  return `${fmtSingle(restRange.min)}-${fmtSingle(restRange.max)} min`;
}
