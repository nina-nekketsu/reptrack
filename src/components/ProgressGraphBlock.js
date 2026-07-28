import React, { useState } from 'react';
import { getLogsLoadError, getSessionsAsc, getSessionsDesc } from '../utils/exerciseHelpers';
import VolumeGraph from './VolumeGraph';
import useOnlineStatus from '../hooks/useOnlineStatus';

export default function ProgressGraphBlock({ logs, exerciseId }) {
  const [open, setOpen] = useState(false);
  const isOnline = useOnlineStatus();
  const logsResolved = logs !== undefined && logs !== null;
  const safeLogs = logsResolved && typeof logs === 'object' ? logs : {};
  const rawHistory = logsResolved ? safeLogs[exerciseId] : undefined;
  const graphError = getLogsLoadError() || (rawHistory !== undefined && !Array.isArray(rawHistory) ? 'invalid-history' : null);
  const sessionsAsc = graphError ? [] : getSessionsAsc(safeLogs, exerciseId);
  const sessionsDesc = graphError ? [] : getSessionsDesc(safeLogs, exerciseId);
  const last5 = sessionsDesc.slice(0, 5).reverse(); // oldest first for display

  const sessionVolume = (session) => Number(session.totalVolume) || (session.sets || []).reduce(
    (sum, set) => sum + (Number(set.weight) || 0) * (Number(set.reps) || 0),
    0
  );

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
          <VolumeGraph
            sessions={sessionsAsc}
            exerciseId={exerciseId}
            loading={!logsResolved}
            offline={!isOnline}
            error={graphError}
          />

          {last5.length > 0 && (
            <div className="last5-sessions">
              <div className="last5-title">Last {last5.length} sessions</div>
              {[...last5].reverse().map((session, i) => {
                const prev = [...last5].reverse()[i + 1];
                const volume = sessionVolume(session);
                const prevVolume = prev ? sessionVolume(prev) : null;
                const diff = prev ? volume - prevVolume : null;
                return (
                  <div className="last5-row" key={session.id || session.date}>
                    <span className="last5-date">
                      {new Date(session.date).toLocaleDateString(undefined, {
                        day: 'numeric',
                        month: 'short',
                      })}
                    </span>
                    <span className="last5-vol">{volume.toLocaleString()} kg</span>
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
