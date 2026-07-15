import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  flushPendingMutations,
  getSyncSnapshot,
  onSyncSnapshotChange,
  retryPendingMutation,
} from '../lib/sync';
import './SyncIndicator.css';

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default function SyncIndicator() {
  const { user, isConfigured } = useAuth();
  const [snapshot, setSnapshot] = useState(() => getSyncSnapshot());
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    const unsubscribe = onSyncSnapshotChange(setSnapshot);
    setSnapshot(getSyncSnapshot());
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!isConfigured || !user || !online) return undefined;
    flushPendingMutations().catch(() => {});
    return undefined;
  }, [isConfigured, online, user]);

  useEffect(() => {
    function handleOnline() {
      setOnline(true);
    }
    function handleOffline() { setOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [isConfigured, user]);

  if (!isConfigured || !user) return null;

  const unsyncedCount = snapshot.pendingCount + snapshot.failedCount + snapshot.syncingCount;
  let icon = '•';
  let label = 'Not synced yet';
  let state = 'unknown';

  if (!online) {
    icon = '⚡';
    label = unsyncedCount > 0
      ? `Offline — ${countLabel(unsyncedCount, 'change')} not synced`
      : 'Offline';
    state = 'offline';
  } else if (snapshot.failedCount > 0 || snapshot.status === 'error') {
    icon = '⚠';
    label = snapshot.failedCount > 0
      ? `${countLabel(snapshot.failedCount, 'change')} failed to sync`
      : 'Sync error';
    state = 'error';
  } else if (snapshot.syncingCount > 0 || snapshot.status === 'syncing') {
    icon = '↻';
    label = 'Syncing changes';
    state = 'syncing';
  } else if (snapshot.pendingCount > 0) {
    icon = '…';
    label = `${countLabel(snapshot.pendingCount, 'change')} pending`;
    state = 'pending';
  } else if (snapshot.lastSuccessfulSyncAt) {
    icon = '✓';
    label = 'Synced';
    state = 'synced';
  }

  async function retryFailed() {
    try {
      snapshot.operations
        .filter((operation) => operation.status === 'failed')
        .forEach((operation) => retryPendingMutation(operation.id));
      await flushPendingMutations();
    } catch {
      // The retained failed operation keeps the UI truthful for another retry.
    }
  }

  return (
    <div
      className={`sync-indicator sync-indicator--truthful sync-indicator--${state}`}
      role="status"
      aria-label={label}
      title={label}
    >
      <span className="sync-indicator__icon" aria-hidden="true">{icon}</span>
      <span className="sync-indicator__label">{label}</span>
      {state === 'error' && snapshot.failedCount > 0 && (
        <button
          className="sync-indicator__retry"
          type="button"
          onClick={retryFailed}
          aria-label="Retry failed sync"
        >
          Retry
        </button>
      )}
    </div>
  );
}
