// src/components/RestAdvisor.js — Rest time suggestion after each set
// Displays rest as a range (not a stopwatch) per PRD Section 5.4.8:
//   "Rest periods are guidelines, not stopwatch requirements."
import React from 'react';
import { getRecommendedRest, formatRestTime } from '../lib/coachEngine';

export default function RestAdvisor({ goal, intensity, isSuperset }) {
  if (!intensity || !goal) return null;

  const restRange = getRecommendedRest(goal, intensity, isSuperset);

  // Contextual guidance
  let hint = null;
  if (isSuperset) {
    hint = 'Supersets — move quickly between exercises, rest after the pair.';
  } else if (intensity === 'hard' || intensity === 'all-out') {
    hint = 'Take what you need. Don\'t rush into a compound movement tired.';
  } else if (intensity === 'light') {
    hint = 'Quick rest — this is warm-up pace.';
  }

  return (
    <div className="rest-advisor">
      <span className="rest-advisor-icon">&#x23F1;</span>
      <div className="rest-advisor-body">
        <span className="rest-advisor-text">
          Rest ~{formatRestTime(restRange)}
        </span>
        <span className="rest-advisor-context">
          {intensity} / {goal}
        </span>
        {hint && <span className="rest-advisor-hint">{hint}</span>}
      </div>
    </div>
  );
}
