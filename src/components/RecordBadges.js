import React from 'react';
import { DumbbellIcon, RepeatIcon, TrendIcon } from './icons';

export default function RecordBadges({ records }) {
  if (!records.maxWeight && !records.maxReps && !records.maxVolume) return null;
  return (
    <div className="record-badges">
      {records.maxWeight > 0 && (
        <div className="record-chip">
          <span className="record-icon"><DumbbellIcon /></span>
          <span className="record-label">Best Weight</span>
          <span className="record-value">{records.maxWeight} kg</span>
        </div>
      )}
      {records.maxReps > 0 && (
        <div className="record-chip">
          <span className="record-icon"><RepeatIcon /></span>
          <span className="record-label">Most Reps</span>
          <span className="record-value">{records.maxReps}</span>
        </div>
      )}
      {records.maxVolume > 0 && (
        <div className="record-chip">
          <span className="record-icon"><TrendIcon /></span>
          <span className="record-label">Best Volume</span>
          <span className="record-value">{records.maxVolume.toLocaleString()} kg</span>
        </div>
      )}
    </div>
  );
}
