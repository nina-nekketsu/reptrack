-- Migration: ensure DELETE RLS policies exist for exercise_logs and exercises.
-- Run in the Supabase SQL editor if exercise_logs is your active flat-log table.

-- ── exercise_logs (flat session table used by sync.js) ───────────────────────
-- Only needed if you're using exercise_logs instead of exercise_sessions/exercise_sets.

-- Drop if it already exists to avoid conflicts
drop policy if exists "Users delete own logs" on exercise_logs;

create policy "Users delete own logs"
  on exercise_logs for delete
  using (auth.uid() = user_id);

-- ── exercises ────────────────────────────────────────────────────────────────
-- Already in schema.sql, but included here for completeness:
drop policy if exists "Users delete own exercises" on exercises;

create policy "Users delete own exercises"
  on exercises for delete
  using (auth.uid() = user_id);

-- ── exercise_sessions (if using the normalized schema) ───────────────────────
-- Already in schema.sql:
drop policy if exists "Users delete own sessions" on exercise_sessions;

create policy "Users delete own sessions"
  on exercise_sessions for delete
  using (auth.uid() = user_id);

-- ── exercise_sets (cascade deletes via session FK, but explicit policy too) ──
-- Already in schema.sql:
drop policy if exists "Users delete own sets" on exercise_sets;

create policy "Users delete own sets"
  on exercise_sets for delete
  using (
    exists (
      select 1 from exercise_sessions s
      where s.id = exercise_sets.session_id
        and s.user_id = auth.uid()
    )
  );
