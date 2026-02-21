import React, { useState } from 'react';
import { getSessionsAsc, getSessionsDesc } from '../utils/exerciseHelpers';
import VolumeGraph from './VolumeGraph';

export default function ProgressGraphBlock({ logs, exerciseId }) {
  const [open, setOpen] = useState(false);
  const sessionsAsc = getSessionsAsc(logs, exerciseId);
  const sessionsDesc = getSessionsDesc(logs, exerciseId);
  const last5 = sessionsDesc.slice(0, 5).reverse(); // oldest first for display

  if (sessionsAsc.length === 0) return null;

  return (
    <div className="progress-graph-block">
      <button
        className="progress-graph-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{open ? '▾' : '▸'} {open ? 'Hide progress graph' : 'Show progress graph'}</span>
      </button>

      {open && (
        <div className="progress-graph-content">
          <VolumeGraph sessions={sessionsAsc} />

          {last5.length > 0 && (
            <div className="last5-sessions">
              <div className="last5-title">Last {last5.length} sessions</div>
              {[...last5].reverse().map((session, i) => {
                const prev = [...last5].reverse()[i + 1];
                const diff = prev ? session.totalVolume - prev.totalVolume : null;
                return (
                  <div className="last5-row" key={session.date}>
                    <span className="last5-date">
                      {new Date(session.date).toLocaleDateString('nl-NL', {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <span className="last5-vol">{session.totalVolume.toLocaleString()} kg</span>
                    {diff !== null && (
                      <span className={`pr-diff ${diff >= 0 ? 'pr-diff--up' : 'pr-diff--down'}`}>
                        {diff >= 0 ? '▲' : '▼'} {Math.abs(diff).toLocaleString()}
                      </span>
                    )}
                    {session.bestSet && (
                      <span className="last5-best">
                        {session.bestSet.reps}×{session.bestSet.weight}kg
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
