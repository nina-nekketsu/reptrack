// src/components/RestAdvisor.js — Rest time suggestion after each set
import React from 'react';
import { getRecommendedRest, formatRestTime } from '../lib/coachEngine';

export default function RestAdvisor({ goal, intensity }) {
  if (!intensity || !goal) return null;

  const restSeconds = getRecommendedRest(goal, intensity);

  return (
    <div className="rest-advisor">
      <span className="rest-advisor-icon">&#x23F1;</span>
      <span className="rest-advisor-text">
        Rest ~{formatRestTime(restSeconds)}
      </span>
      <span className="rest-advisor-context">
        {intensity} / {goal}
      </span>
    </div>
  );
}
