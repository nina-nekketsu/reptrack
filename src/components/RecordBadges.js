import React, { useEffect, useRef } from 'react';
import { DumbbellIcon, RepeatIcon, TrendIcon } from './icons';

function recordIdentity(type, value) {
  return `${type}:${value}`;
}

export default function RecordBadges({ records }) {
  const maxWeight = Number(records?.maxWeight) || 0;
  const maxReps = Number(records?.maxReps) || 0;
  const maxVolume = Number(records?.maxVolume) || 0;
  const previousRecordsRef = useRef({ maxWeight, maxReps, maxVolume });
  const seenRecordIdentitiesRef = useRef(new Set([
    maxWeight > 0 ? recordIdentity('maxWeight', maxWeight) : null,
    maxReps > 0 ? recordIdentity('maxReps', maxReps) : null,
    maxVolume > 0 ? recordIdentity('maxVolume', maxVolume) : null,
  ].filter(Boolean)));

  const isNewRecord = (type, value) => (
    value > 0
    && value > previousRecordsRef.current[type]
    && !seenRecordIdentitiesRef.current.has(recordIdentity(type, value))
  );
  const newMaxWeight = isNewRecord('maxWeight', maxWeight);
  const newMaxReps = isNewRecord('maxReps', maxReps);
  const newMaxVolume = isNewRecord('maxVolume', maxVolume);

  useEffect(() => {
    if (maxWeight > 0) seenRecordIdentitiesRef.current.add(recordIdentity('maxWeight', maxWeight));
    if (maxReps > 0) seenRecordIdentitiesRef.current.add(recordIdentity('maxReps', maxReps));
    if (maxVolume > 0) seenRecordIdentitiesRef.current.add(recordIdentity('maxVolume', maxVolume));
    previousRecordsRef.current = { maxWeight, maxReps, maxVolume };
  }, [maxWeight, maxReps, maxVolume]);

  if (!maxWeight && !maxReps && !maxVolume) return null;

  return (
    <div className="record-badges">
      {maxWeight > 0 && (
        <div
          className={`record-chip${newMaxWeight ? ' record-chip--new-record' : ''}`}
          key={recordIdentity('maxWeight', maxWeight)}
        >
          <span className="record-icon"><DumbbellIcon /></span>
          <span className="record-label">Best Weight</span>
          <span className="record-value">{maxWeight} kg</span>
        </div>
      )}
      {maxReps > 0 && (
        <div
          className={`record-chip${newMaxReps ? ' record-chip--new-record' : ''}`}
          key={recordIdentity('maxReps', maxReps)}
        >
          <span className="record-icon"><RepeatIcon /></span>
          <span className="record-label">Most Reps</span>
          <span className="record-value">{maxReps}</span>
        </div>
      )}
      {maxVolume > 0 && (
        <div
          className={`record-chip${newMaxVolume ? ' record-chip--new-record' : ''}`}
          key={recordIdentity('maxVolume', maxVolume)}
        >
          <span className="record-icon"><TrendIcon /></span>
          <span className="record-label">Best Volume</span>
          <span className="record-value">{maxVolume.toLocaleString()} kg</span>
        </div>
      )}
    </div>
  );
}
