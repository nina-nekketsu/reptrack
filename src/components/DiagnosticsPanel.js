import { useState } from 'react';
import { clientDiagnostics } from '../lib/clientDiagnosticsRuntime';
import { getSyncSnapshot } from '../lib/sync';
import './DiagnosticsPanel.css';

function loadSnapshot() {
  return clientDiagnostics.getSnapshot(getSyncSnapshot());
}

function formatTimestamp(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function toDateTimeValue(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export default function DiagnosticsPanel() {
  const [snapshot, setSnapshot] = useState(loadSnapshot);
  const failureCount = Object.values(snapshot.syncFailures || {})
    .reduce((total, count) => total + count, 0);

  return (
    <details className="diagnostics-panel">
      <summary>Diagnostics</summary>
      <p className="diagnostics-panel__privacy">
        Local, sanitized support data. Workout content and sync payloads are excluded.
      </p>
      <dl className="diagnostics-panel__facts">
        <div><dt>Build</dt><dd>{snapshot.buildId}</dd></div>
        <div><dt>Queue</dt><dd>{snapshot.queueDepth} queued</dd></div>
        <div><dt>Last sync</dt><dd>{formatTimestamp(snapshot.lastSuccessfulSyncAt)}</dd></div>
        <div><dt>Failures</dt><dd>{failureCount} sync failures</dd></div>
      </dl>
      <button
        className="diagnostics-panel__refresh"
        type="button"
        onClick={() => setSnapshot(loadSnapshot())}
      >
        Refresh diagnostics
      </button>
      {(snapshot.errors || []).length > 0 && (
        <div className="diagnostics-panel__errors">
          <h4>Recent errors</h4>
          <ul>
            {snapshot.errors.map((error, index) => (
              <li key={`${error.occurredAt}-${error.source}-${index}`}>
                <span>{error.message}</span>
                <time dateTime={toDateTimeValue(error.occurredAt)}>{formatTimestamp(error.occurredAt)}</time>
              </li>
            ))}
          </ul>
        </div>
      )}
    </details>
  );
}
