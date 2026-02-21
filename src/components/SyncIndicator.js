// src/components/SyncIndicator.js
// Small floating icon showing sync status: ✓ synced / ↻ syncing / ⚡ offline

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { getSyncStatus, onSyncStatusChange } from '../lib/sync';

export default function SyncIndicator() {
  const { user, isConfigured } = useAuth();
  const [status, setStatus] = useState(getSyncStatus());
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    return onSyncStatusChange(setStatus);
  }, []);

  useEffect(() => {
    function handleOnline() { setOnline(true); }
    function handleOffline() { setOnline(false); }
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Only show when Supabase is configured and user is logged in
  if (!isConfigured || !user) return null;

  let icon, label, className;

  if (!online) {
    icon = '⚡';
    label = 'Offline';
    className = 'sync-indicator sync-indicator--offline';
  } else if (status === 'syncing') {
    icon = '↻';
    label = 'Syncing';
    className = 'sync-indicator sync-indicator--syncing';
  } else if (status === 'error') {
    icon = '⚠';
    label = 'Sync error';
    className = 'sync-indicator sync-indicator--error';
  } else {
    icon = '✓';
    label = 'Synced';
    className = 'sync-indicator sync-indicator--synced';
  }

  return (
    <div className={className} title={label}>
      <span className="sync-indicator__icon">{icon}</span>
    </div>
  );
}
