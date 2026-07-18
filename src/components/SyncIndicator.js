import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  flushPendingMutations,
  getSyncSnapshot,
  onSyncSnapshotChange,
  retryPendingMutation,
} from '../lib/sync';
import { BoltIcon, CheckIcon, RepeatIcon, WarningIcon } from './icons';
import './SyncIndicator.css';

function countLabel(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function isReconnectableFailure(operation) {
  if (operation.status !== 'failed') return false;
  const code = String(operation.lastError?.code || '').toUpperCase();
  const message = String(operation.lastError?.message || '').toLowerCase();
  return code.includes('NETWORK')
    || code.includes('FETCH')
    || code.includes('OFFLINE')
    || message.includes('failed to fetch')
    || message.includes('network request failed')
    || message.includes('networkerror')
    || message === 'load failed';
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
    getSyncSnapshot().operations
      .filter(isReconnectableFailure)
      .forEach((operation) => retryPendingMutation(operation.id));
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
  let Icon = null;
  let label = 'Not synced yet';
  let state = 'unknown';

  if (!online) {
    Icon = BoltIcon;
    label = unsyncedCount > 0
      ? `Offline — ${countLabel(unsyncedCount, 'change')} not synced`
      : 'Offline';
    state = 'offline';
  } else if (snapshot.authExpired || snapshot.pausedReason === 'auth-expired') {
    Icon = WarningIcon;
    label = 'Sign in again to sync';
    state = 'error';
  } else if (snapshot.failedCount > 0 || snapshot.status === 'error') {
    Icon = WarningIcon;
    label = snapshot.failedCount > 0
      ? `${countLabel(snapshot.failedCount, 'change')} failed to sync`
      : 'Sync error';
    state = 'error';
  } else if (snapshot.syncingCount > 0 || snapshot.status === 'syncing') {
    Icon = RepeatIcon;
    label = 'Syncing changes';
    state = 'syncing';
  } else if (snapshot.pendingCount > 0) {
    Icon = null;
    label = `${countLabel(snapshot.pendingCount, 'change')} pending`;
    state = 'pending';
  } else if (snapshot.lastSuccessfulSyncAt) {
    Icon = CheckIcon;
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
      role={state === 'error' ? 'alert' : 'status'}
      aria-label={label}
      title={label}
    >
      <span className="sync-indicator__icon" aria-hidden="true">{Icon ? <Icon /> : '...'}</span>
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
