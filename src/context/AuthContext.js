// src/context/AuthContext.js
// Manages Supabase auth state + data sync via src/lib/sync.js

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import { pullAll, pushAll, getSyncStatus, onSyncStatusChange } from '../lib/sync';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [syncing, setSyncing]     = useState(false);
  const [syncError, setSyncError] = useState(null);
  const [syncStatus, setSyncStatusState] = useState(getSyncStatus());

  // Track sync status from the sync module
  useEffect(() => {
    return onSyncStatusChange((status) => {
      setSyncStatusState(status);
      setSyncing(status === 'syncing');
      if (status === 'error') {
        setSyncError('Sync failed');
      } else {
        setSyncError(null);
      }
    });
  }, []);

  // Pull remote data into localStorage, then push any local-only data back
  const syncData = useCallback(async (userId) => {
    if (!supabase || !userId) return;
    setSyncing(true);
    setSyncError(null);
    try {
      await pullAll(userId);
      await pushAll(userId);
    } catch (err) {
      console.error('[AuthContext] syncData error:', err);
      setSyncError(err.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, []);

  // Auth state listener
  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) syncData(u.id);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      setUser(u);
      if (u) syncData(u.id);
    });

    return () => subscription.unsubscribe();
  }, [syncData]);

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    syncing,
    syncError,
    syncStatus,
    signOut,
    syncData,
    isConfigured,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
