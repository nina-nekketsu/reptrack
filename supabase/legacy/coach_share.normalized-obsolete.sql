-- ─────────────────────────────────────────────────────────────────────────────
-- RepTrack – Coach Share Feature
-- Run this in your Supabase SQL editor AFTER running schema.sql.
--
-- What this creates:
--   1. coach_shares table  – stores one share token per user
--   2. get_coach_data RPC  – SECURITY DEFINER function that returns all relevant
--                            data for a given token (accessible via anon key)
--   3. RLS policies        – anon cannot read coach_shares directly; only the RPC
--                            can bypass RLS (SECURITY DEFINER)
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. coach_shares ──────────────────────────────────────────────────────────
create table if not exists coach_shares (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  token       uuid not null default gen_random_uuid(),  -- raw UUID v4, unguessable
  enabled     boolean not null default true,
  created_at  timestamptz not null default now(),
  rotated_at  timestamptz,

  unique (user_id),   -- one share record per user
  unique (token)      -- tokens must be globally unique
);

alter table coach_shares enable row level security;

-- Only the authenticated owner can read/write their own record
create policy "Owner reads own share"
  on coach_shares for select
  using (auth.uid() = user_id);

create policy "Owner inserts own share"
  on coach_shares for insert
  with check (auth.uid() = user_id);

create policy "Owner updates own share"
  on coach_shares for update
  using (auth.uid() = user_id);

create policy "Owner deletes own share"
  on coach_shares for delete
  using (auth.uid() = user_id);

-- Anon role has NO policy → cannot read coach_shares at all.
-- The RPC below uses SECURITY DEFINER to bypass RLS safely.

-- ── 2. get_coach_data RPC ────────────────────────────────────────────────────
-- Returns a JSON object with the user's data for a given share token.
-- Returns NULL (not an error) when the token is invalid or sharing is disabled.
-- SECURITY DEFINER: runs as the function owner (postgres), bypassing RLS.
-- The anon key can call this function but cannot read the underlying tables.
create or replace function get_coach_data(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_exercises jsonb;
  v_last_session_sets jsonb;
  v_prs jsonb;
  v_volume_history jsonb;
  v_synced_at timestamptz;
begin
  -- ── Validate token ──────────────────────────────────────────────────────
  select user_id, created_at
  into v_user_id, v_synced_at
  from coach_shares
  where token = p_token
    and enabled = true;

  if v_user_id is null then
    return null;
  end if;

  -- ── Exercises ────────────────────────────────────────────────────────────
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id',           e.id,
      'local_id',     e.local_id,
      'name',         e.name,
      'muscle_group', e.muscle_group,
      'type',         e.exercise_type
    ) order by e.name
  ), '[]'::jsonb)
  into v_exercises
  from exercises e
  where e.user_id = v_user_id;

  -- ── Last session sets (most recent exercise_session + its sets) ──────────
  -- Find the most recent session across all exercises
  with latest_session as (
    select es.id, es.local_exercise_id, es.started_at, es.total_reps, es.total_volume_kg,
           e.name as exercise_name
    from exercise_sessions es
    join exercises e on e.local_id = es.local_exercise_id and e.user_id = v_user_id
    where es.user_id = v_user_id
    order by es.started_at desc
    limit 1
  ),
  session_sets as (
    select ls.exercise_name, ls.started_at, ls.total_reps, ls.total_volume_kg,
           jsonb_agg(
             jsonb_build_object(
               'set_number', exs.set_number,
               'reps',       exs.reps,
               'weight_kg',  exs.weight_kg
             ) order by exs.set_number
           ) as sets
    from latest_session ls
    join exercise_sets exs on exs.session_id = ls.id
    group by ls.exercise_name, ls.started_at, ls.total_reps, ls.total_volume_kg
  )
  select coalesce(
    (select jsonb_build_object(
      'exercise_name',   ss.exercise_name,
      'started_at',      ss.started_at,
      'total_reps',      ss.total_reps,
      'total_volume_kg', ss.total_volume_kg,
      'sets',            ss.sets
    ) from session_sets ss),
    '{}'::jsonb
  )
  into v_last_session_sets;

  -- ── PRs per exercise (max weight, max reps, max volume) ─────────────────
  select coalesce(jsonb_agg(pr_data), '[]'::jsonb)
  into v_prs
  from (
    select jsonb_build_object(
      'exercise_name', e.name,
      'max_weight_kg', max(exs.weight_kg),
      'max_reps',      max(exs.reps),
      'max_volume_kg', max(es.total_volume_kg)
    ) as pr_data
    from exercises e
    join exercise_sessions es  on es.local_exercise_id = e.local_id and es.user_id = v_user_id
    join exercise_sets exs     on exs.session_id = es.id
    where e.user_id = v_user_id
    group by e.name
    order by e.name
  ) sub;

  -- ── Volume history (last 30 sessions, for the graph) ────────────────────
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'date',            es.started_at,
      'exercise_name',   e.name,
      'total_volume_kg', es.total_volume_kg
    ) order by es.started_at asc
  ), '[]'::jsonb)
  into v_volume_history
  from (
    select *
    from exercise_sessions
    where user_id = v_user_id
    order by started_at desc
    limit 30
  ) es
  join exercises e on e.local_id = es.local_exercise_id and e.user_id = v_user_id;

  -- ── Build final result ───────────────────────────────────────────────────
  return jsonb_build_object(
    'exercises',        v_exercises,
    'last_session',     v_last_session_sets,
    'prs',              v_prs,
    'volume_history',   v_volume_history,
    'synced_at',        v_synced_at
  );
end;
$$;

-- Grant execute to anon and authenticated roles
grant execute on function get_coach_data(uuid) to anon, authenticated;

-- ── 3. Indexes ───────────────────────────────────────────────────────────────
create index if not exists idx_coach_shares_token   on coach_shares(token) where enabled = true;
create index if not exists idx_coach_shares_user_id on coach_shares(user_id);
