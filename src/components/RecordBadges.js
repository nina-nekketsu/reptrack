import React from 'react';

export default function RecordBadges({ records }) {
  if (!records.maxWeight && !records.maxReps && !records.maxVolume) return null;
  return (
    <div className="record-badges">
      {records.maxWeight > 0 && (
        <div className="record-chip">
          <span className="record-icon">🏋️</span>
          <span className="record-label">Best Weight</span>
          <span className="record-value">{records.maxWeight} kg</span>
        </div>
      )}
      {records.maxReps > 0 && (
        <div className="record-chip">
          <span className="record-icon">🔁</span>
          <span className="record-label">Most Reps</span>
          <span className="record-value">{records.maxReps}</span>
        </div>
      )}
      {records.maxVolume > 0 && (
        <div className="record-chip">
          <span className="record-icon">📈</span>
          <span className="record-label">Best Volume</span>
          <span className="record-value">{records.maxVolume.toLocaleString()} kg</span>
        </div>
      )}
    </div>
  );
}
