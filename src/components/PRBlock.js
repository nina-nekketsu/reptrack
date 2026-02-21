import React from 'react';
import { getSessionsDesc } from '../utils/exerciseHelpers';

export default function PRBlock({ logs, exerciseId }) {
  const sessions = getSessionsDesc(logs, exerciseId);
  if (sessions.length === 0) return null;

  // All-time best set by volume (reps x weight)
  let allTimeBestSet = null;
  let allTimeBestVol = 0;
  sessions.forEach((session) => {
    session.sets.forEach((s) => {
      const vol = (Number(s.reps) || 0) * (Number(s.weight) || 0);
      if (vol > allTimeBestVol) {
        allTimeBestVol = vol;
        allTimeBestSet = s;
      }
    });
  });

  // Best session volume
  const bestSessionVol = Math.max(...sessions.map((s) => s.totalVolume || 0));

  // Last session volume
  const lastVol = sessions[0]?.totalVolume || 0;
  const prevVol = sessions[1]?.totalVolume || null;
  const volDiff = prevVol !== null ? lastVol - prevVol : null;

  return (
    <div className="pr-block">
      <div className="pr-block__title">Personal Records</div>
      <div className="pr-block__grid">
        {allTimeBestSet && (
          <div className="pr-item">
            <span className="pr-item__icon">🏆</span>
            <span className="pr-item__label">Best Set</span>
            <span className="pr-item__value">
              {allTimeBestSet.reps} × {allTimeBestSet.weight} kg
            </span>
          </div>
        )}
        <div className="pr-item">
          <span className="pr-item__icon">📈</span>
          <span className="pr-item__label">Best Session</span>
          <span className="pr-item__value">{bestSessionVol.toLocaleString()} kg</span>
        </div>
        <div className="pr-item">
          <span className="pr-item__icon">🕐</span>
          <span className="pr-item__label">Last Session</span>
          <span className="pr-item__value">
            {lastVol.toLocaleString()} kg
            {volDiff !== null && (
              <span className={`pr-diff ${volDiff >= 0 ? 'pr-diff--up' : 'pr-diff--down'}`}>
                {volDiff >= 0 ? ' ▲' : ' ▼'}{Math.abs(volDiff).toLocaleString()}
              </span>
            )}
          </span>
        </div>
      </div>
    </div>
  );
}
