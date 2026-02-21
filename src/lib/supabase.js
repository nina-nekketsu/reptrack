// src/lib/supabase.js
// Supabase client — returns null when env vars are not configured.
// The app works offline-only in that case.

import { createClient } from '@supabase/supabase-js';

const url  = process.env.REACT_APP_SUPABASE_URL;
const key  = process.env.REACT_APP_SUPABASE_ANON_KEY;

export const supabase =
  url && key && url !== 'YOUR_SUPABASE_URL'
    ? createClient(url, key)
    : null;

export const isConfigured = Boolean(supabase);
