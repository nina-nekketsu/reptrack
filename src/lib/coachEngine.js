// src/lib/coachEngine.js — Progressive Overload Engine
// Core coaching logic: compares sets to history, detects overload levers,
// generates coaching messages, plateau detection, progression tables.

import { loadLogs } from '../utils/exerciseHelpers';

// ── Rest time recommendations (seconds) ─────────────────────────────────
const REST_TABLE = {
  hypertrophy: { light: 60, moderate: 120, hard: 180, 'all-out': 240 },
  strength:    { light: 120, moderate: 150, hard: 240, 'all-out': 300 },
};

export function getRecommendedRest(goal, intensity) {
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
const MESSAGES = {
  improved: {
    soft: [
      'Nice work! You improved.',
      'Great effort, keep it up!',
      'You\'re making progress!',
    ],
    balanced: [
      'Solid improvement. Keep pushing.',
      'Better than last time. That\'s the goal.',
      'Progress detected. Stay consistent.',
    ],
    tough: [
      'Good. Now do it again next time.',
      'Improvement noted. Don\'t get complacent.',
      'That\'s progress. Maintain this standard.',
    ],
    aggressive: [
      'THAT\'S what I\'m talking about!',
      'Harder than last time. EXACTLY right.',
      'You showed up and delivered. Respect.',
    ],
  },
  maintained: {
    soft: [
      'Consistent performance — that\'s valuable.',
      'Same as before, and that\'s okay.',
      'Staying steady is still showing up.',
    ],
    balanced: [
      'Maintained. Try to push one lever next set.',
      'Holding steady. Look for a small improvement.',
      'Same performance. Can you add a rep?',
    ],
    tough: [
      'Same as last time. Time to push harder.',
      'No improvement. Find a way to progress.',
      'Maintenance is temporary. Push forward.',
    ],
    aggressive: [
      'Same numbers. Not good enough. Push.',
      'Where\'s the progress? Step it up.',
      'HARDER than last time. That\'s the rule.',
    ],
  },
  regressed: {
    soft: [
      'A bit below last time. No worries — bad days happen.',
      'Slight dip. Focus on form and try again.',
      'Not every session is a PR. Rest and recover.',
    ],
    balanced: [
      'Below last session. Could be fatigue. Keep the weight, aim for reps.',
      'Regression — it happens. Hold weight steady, rebuild reps.',
      'Off day. Don\'t drop weight yet, try again next session.',
    ],
    tough: [
      'Down from last time. Check your recovery.',
      'Regression. Are you sleeping and eating enough?',
      'Weaker today. Fix what\'s outside the gym.',
    ],
    aggressive: [
      'Weaker than last time. Figure out why.',
      'Down numbers. Sleep, food, stress — fix it.',
      'Not acceptable long term. Address recovery NOW.',
    ],
  },
  first: {
    soft: ['First time logging this exercise! Great start.'],
    balanced: ['First set logged. This is your baseline.'],
    tough: ['Baseline set. Now beat it every time.'],
    aggressive: ['Starting point locked in. Only up from here.'],
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

// ── Overload lever suggestion ───────────────────────────────────────────
const OVERLOAD_LEVERS = [
  { lever: 'reps',   label: 'Add 1-2 reps per set' },
  { lever: 'weight', label: 'Increase weight by 2.5kg' },
  { lever: 'tempo',  label: 'Slow the eccentric (3s down)' },
  { lever: 'rest',   label: 'Reduce rest time by 15-30s' },
  { lever: 'rir',    label: 'Push closer to failure (lower RIR)' },
  { lever: 'rom',    label: 'Increase range of motion' },
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
export function formatRestTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (s === 0) return `${m} min`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
