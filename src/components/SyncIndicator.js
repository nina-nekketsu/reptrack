import React, { useEffect, useRef, useState } from 'react';
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

function getSyncPresentation(snapshot, online) {
  const unsyncedCount = snapshot.pendingCount + snapshot.failedCount + snapshot.syncingCount;

  if (!online) {
    return {
      Icon: BoltIcon,
      label: unsyncedCount > 0
        ? `Offline — ${countLabel(unsyncedCount, 'change')} not synced`
        : 'Offline',
      state: 'offline',
    };
  }

  if (snapshot.authExpired || snapshot.pausedReason === 'auth-expired') {
    return { Icon: WarningIcon, label: 'Sign in again to sync', state: 'error' };
  }

  if (snapshot.failedCount > 0 || snapshot.status === 'error') {
    return {
      Icon: WarningIcon,
      label: snapshot.failedCount > 0
        ? `${countLabel(snapshot.failedCount, 'change')} failed to sync`
        : 'Sync error',
      state: 'error',
    };
  }

  if (snapshot.syncingCount > 0 || snapshot.status === 'syncing') {
    return { Icon: RepeatIcon, label: 'Syncing changes', state: 'syncing' };
  }

  if (snapshot.pendingCount > 0) {
    return {
      Icon: null,
      label: `${countLabel(snapshot.pendingCount, 'change')} pending`,
      state: 'pending',
    };
  }

  if (snapshot.lastSuccessfulSyncAt) {
    return { Icon: CheckIcon, label: 'Synced', state: 'synced' };
  }

  return { Icon: null, label: 'Not synced yet', state: 'unknown' };
}

export default function SyncIndicator() {
  const { user, isConfigured } = useAuth();
  const [snapshot, setSnapshot] = useState(() => getSyncSnapshot());
  const [online, setOnline] = useState(navigator.onLine);
  const [retrying, setRetrying] = useState(false);
  const retryingRef = useRef(false);

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

  const { Icon, label, state } = getSyncPresentation(snapshot, online);
  const previousStateRef = useRef(state);
  const stateChanged = previousStateRef.current !== state;

  useEffect(() => {
    previousStateRef.current = state;
  }, [state]);

  if (!isConfigured || !user) return null;

  async function retryFailed() {
    if (retryingRef.current) return;
    retryingRef.current = true;
    setRetrying(true);
    try {
      snapshot.operations
        .filter((operation) => operation.status === 'failed')
        .forEach((operation) => retryPendingMutation(operation.id));
      await flushPendingMutations();
    } catch {
      // The retained failed operation keeps the UI truthful for another retry.
    } finally {
      retryingRef.current = false;
      setRetrying(false);
    }
  }

  return (
    <div
      className={`sync-indicator sync-indicator--truthful sync-indicator--${state}`}
      role={state === 'error' ? 'alert' : 'status'}
      aria-label={label}
      title={label}
    >
      <span
        key={state}
        className={`sync-indicator__icon ${stateChanged ? 'sync-indicator__icon--state-change' : ''}`.trim()}
        aria-hidden="true"
      >
        {Icon ? <Icon /> : '...'}
      </span>
      <span className="sync-indicator__label">{label}</span>
      {state === 'error' && snapshot.failedCount > 0 && (
        <button
          className="sync-indicator__retry"
          type="button"
          onClick={retryFailed}
          disabled={retrying}
          aria-busy={retrying}
          aria-label={retrying ? 'Retrying failed sync' : 'Retry failed sync'}
        >
          {retrying ? 'Retrying…' : 'Retry'}
        </button>
      )}
    </div>
  );
}
