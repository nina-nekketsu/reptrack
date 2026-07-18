-- RepTrack canonical Supabase schema snapshot
-- Generated from the current flat-JSONB application contract on 2026-07-18.
-- This file is the fresh-project source of truth. It is NOT an instruction to
-- mutate production directly; production changes require a reviewed additive
-- migration and Lloyd's explicit approval for the exact SQL and target.

create extension if not exists "pgcrypto";

-- ── Core local-first entities ────────────────────────────────────────────────

create table if not exists public.exercises (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  muscle_group text,
  type text not null default 'Strength',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, user_id)
);

create table if not exists public.workout_plans (
  id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  exercises jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (id, user_id),
  constraint workout_plans_exercises_array check (jsonb_typeof(exercises) = 'array')
);

create table if not exists public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  date timestamptz not null,
  sets jsonb not null default '[]'::jsonb,
  best_set jsonb,
  total_reps integer not null default 0,
  total_volume numeric not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, exercise_id, date),
  constraint exercise_logs_sets_array check (jsonb_typeof(sets) = 'array')
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint user_settings_object check (jsonb_typeof(settings) = 'object')
);

create table if not exists public.workout_timer_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session jsonb not null,
  updated_at timestamptz not null default now(),
  constraint active_sessions_object check (jsonb_typeof(session) = 'object')
);

-- ── Coach sharing and live coaching ─────────────────────────────────────────

create table if not exists public.coach_shares (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token uuid not null default gen_random_uuid(),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  rotated_at timestamptz,
  unique (user_id),
  unique (token)
);

create table if not exists public.coach_workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_started_at timestamptz not null,
  local_ended_at timestamptz,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coach_workout_sessions_status_check
    check (status in ('active', 'completed', 'cancelled')),
  constraint coach_workout_sessions_user_local_started_unique
    unique (user_id, local_started_at)
);

create table if not exists public.coaching_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null references public.coach_workout_sessions(id) on delete cascade,
  exercise_log_id uuid not null references public.exercise_logs(id) on delete cascade,
  exercise_id text not null,
  set_index integer,
  client_set_id text,
  set_fingerprint text,
  message text not null,
  source text not null default 'deterministic',
  provider text,
  model text,
  latency_ms integer,
  prompt text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint coaching_messages_source_check
    check (source in ('ai', 'deterministic'))
);

-- ── Row-level security: authenticated owners only ───────────────────────────

alter table public.exercises enable row level security;
alter table public.workout_plans enable row level security;
alter table public.exercise_logs enable row level security;
alter table public.user_settings enable row level security;
alter table public.workout_timer_state enable row level security;
alter table public.active_sessions enable row level security;
alter table public.coach_shares enable row level security;
alter table public.coach_workout_sessions enable row level security;
alter table public.coaching_messages enable row level security;

-- Core tables share the same owner policy shape. Policy names stay explicit so
-- Supabase's policy inspector remains readable.
drop policy if exists "exercises_select_own" on public.exercises;
create policy "exercises_select_own" on public.exercises for select using (auth.uid() = user_id);
drop policy if exists "exercises_insert_own" on public.exercises;
create policy "exercises_insert_own" on public.exercises for insert with check (auth.uid() = user_id);
drop policy if exists "exercises_update_own" on public.exercises;
create policy "exercises_update_own" on public.exercises for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "exercises_delete_own" on public.exercises;
create policy "exercises_delete_own" on public.exercises for delete using (auth.uid() = user_id);

drop policy if exists "workout_plans_select_own" on public.workout_plans;
create policy "workout_plans_select_own" on public.workout_plans for select using (auth.uid() = user_id);
drop policy if exists "workout_plans_insert_own" on public.workout_plans;
create policy "workout_plans_insert_own" on public.workout_plans for insert with check (auth.uid() = user_id);
drop policy if exists "workout_plans_update_own" on public.workout_plans;
create policy "workout_plans_update_own" on public.workout_plans for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "workout_plans_delete_own" on public.workout_plans;
create policy "workout_plans_delete_own" on public.workout_plans for delete using (auth.uid() = user_id);

drop policy if exists "exercise_logs_select_own" on public.exercise_logs;
create policy "exercise_logs_select_own" on public.exercise_logs for select using (auth.uid() = user_id);
drop policy if exists "exercise_logs_insert_own" on public.exercise_logs;
create policy "exercise_logs_insert_own" on public.exercise_logs for insert with check (auth.uid() = user_id);
drop policy if exists "exercise_logs_update_own" on public.exercise_logs;
create policy "exercise_logs_update_own" on public.exercise_logs for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "exercise_logs_delete_own" on public.exercise_logs;
create policy "exercise_logs_delete_own" on public.exercise_logs for delete using (auth.uid() = user_id);

drop policy if exists "user_settings_select_own" on public.user_settings;
create policy "user_settings_select_own" on public.user_settings for select using (auth.uid() = user_id);
drop policy if exists "user_settings_insert_own" on public.user_settings;
create policy "user_settings_insert_own" on public.user_settings for insert with check (auth.uid() = user_id);
drop policy if exists "user_settings_update_own" on public.user_settings;
create policy "user_settings_update_own" on public.user_settings for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "user_settings_delete_own" on public.user_settings;
create policy "user_settings_delete_own" on public.user_settings for delete using (auth.uid() = user_id);

drop policy if exists "workout_timer_state_select_own" on public.workout_timer_state;
create policy "workout_timer_state_select_own" on public.workout_timer_state for select using (auth.uid() = user_id);
drop policy if exists "workout_timer_state_insert_own" on public.workout_timer_state;
create policy "workout_timer_state_insert_own" on public.workout_timer_state for insert with check (auth.uid() = user_id);
drop policy if exists "workout_timer_state_update_own" on public.workout_timer_state;
create policy "workout_timer_state_update_own" on public.workout_timer_state for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "workout_timer_state_delete_own" on public.workout_timer_state;
create policy "workout_timer_state_delete_own" on public.workout_timer_state for delete using (auth.uid() = user_id);

drop policy if exists "active_sessions_select_own" on public.active_sessions;
create policy "active_sessions_select_own" on public.active_sessions for select using (auth.uid() = user_id);
drop policy if exists "active_sessions_insert_own" on public.active_sessions;
create policy "active_sessions_insert_own" on public.active_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "active_sessions_update_own" on public.active_sessions;
create policy "active_sessions_update_own" on public.active_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "active_sessions_delete_own" on public.active_sessions;
create policy "active_sessions_delete_own" on public.active_sessions for delete using (auth.uid() = user_id);

drop policy if exists "coach_shares_select_own" on public.coach_shares;
create policy "coach_shares_select_own" on public.coach_shares for select using (auth.uid() = user_id);
drop policy if exists "coach_shares_insert_own" on public.coach_shares;
create policy "coach_shares_insert_own" on public.coach_shares for insert with check (auth.uid() = user_id);
drop policy if exists "coach_shares_update_own" on public.coach_shares;
create policy "coach_shares_update_own" on public.coach_shares for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "coach_shares_delete_own" on public.coach_shares;
create policy "coach_shares_delete_own" on public.coach_shares for delete using (auth.uid() = user_id);

drop policy if exists "coach_workout_sessions_select_own" on public.coach_workout_sessions;
create policy "coach_workout_sessions_select_own" on public.coach_workout_sessions for select using (auth.uid() = user_id);
drop policy if exists "coach_workout_sessions_insert_own" on public.coach_workout_sessions;
create policy "coach_workout_sessions_insert_own" on public.coach_workout_sessions for insert with check (auth.uid() = user_id);
drop policy if exists "coach_workout_sessions_update_own" on public.coach_workout_sessions;
create policy "coach_workout_sessions_update_own" on public.coach_workout_sessions for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "coach_workout_sessions_delete_own" on public.coach_workout_sessions;
create policy "coach_workout_sessions_delete_own" on public.coach_workout_sessions for delete using (auth.uid() = user_id);

drop policy if exists "coaching_messages_select_own" on public.coaching_messages;
create policy "coaching_messages_select_own" on public.coaching_messages for select using (auth.uid() = user_id);
drop policy if exists "coaching_messages_insert_own" on public.coaching_messages;
create policy "coaching_messages_insert_own" on public.coaching_messages for insert with check (auth.uid() = user_id);
drop policy if exists "coaching_messages_update_own" on public.coaching_messages;
create policy "coaching_messages_update_own" on public.coaching_messages for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "coaching_messages_delete_own" on public.coaching_messages;
create policy "coaching_messages_delete_own" on public.coaching_messages for delete using (auth.uid() = user_id);

-- ── Deterministic active-session merge ──────────────────────────────────────

create or replace function public.merge_active_session(p_user_id uuid, p_session jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_session jsonb;
  current_updated timestamptz;
  incoming_updated timestamptz;
  incoming_status text;
  stored_status text;
  winner jsonb;
begin
  if auth.uid() is distinct from p_user_id then
    raise exception 'not authorized';
  end if;
  if p_session is null or jsonb_typeof(p_session) <> 'object' then
    raise exception 'invalid session';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select session into current_session
  from public.active_sessions
  where user_id = p_user_id
  for update;

  if current_session is null then
    winner := p_session;
  else
    current_updated := coalesce(
      nullif(current_session->>'updatedAt', '')::timestamptz,
      nullif(current_session->>'startedAt', '')::timestamptz,
      '-infinity'::timestamptz
    );
    incoming_updated := coalesce(
      nullif(p_session->>'updatedAt', '')::timestamptz,
      nullif(p_session->>'startedAt', '')::timestamptz,
      '-infinity'::timestamptz
    );
    incoming_status := coalesce(p_session->>'status', 'active');
    stored_status := coalesce(current_session->>'status', 'active');

    if incoming_updated > current_updated then
      winner := p_session;
    elsif incoming_updated < current_updated then
      winner := current_session;
    elsif incoming_status = 'ended' and stored_status = 'active' then
      winner := p_session;
    else
      winner := current_session;
    end if;
  end if;

  insert into public.active_sessions (user_id, session, updated_at)
  values (p_user_id, winner, now())
  on conflict (user_id) do update
    set session = excluded.session,
        updated_at = excluded.updated_at;

  return winner;
end;
$$;

revoke all on function public.merge_active_session(uuid, jsonb) from public;
grant execute on function public.merge_active_session(uuid, jsonb) to authenticated;

-- ── Token-scoped read-only coach view over the flat JSONB model ─────────────

create or replace function public.get_coach_data(p_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with share as (
    select user_id, created_at, rotated_at
    from public.coach_shares
    where token = p_token and enabled = true
    limit 1
  ),
  athlete_exercises as (
    select e.*
    from public.exercises e
    join share s on s.user_id = e.user_id
  ),
  athlete_logs as (
    select l.*, e.name as exercise_name
    from public.exercise_logs l
    join share s on s.user_id = l.user_id
    left join athlete_exercises e on e.id = l.exercise_id and e.user_id = l.user_id
  ),
  expanded_sets as (
    select
      l.exercise_id,
      l.exercise_name,
      l.total_volume,
      set_item.value as set_value
    from athlete_logs l
    cross join lateral jsonb_array_elements(l.sets) as set_item(value)
  ),
  latest_log as (
    select * from athlete_logs order by date desc limit 1
  ),
  recent_volume as (
    select * from athlete_logs order by date desc limit 30
  )
  select case when exists (select 1 from share) then jsonb_build_object(
    'exercises', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id,
        'local_id', e.id,
        'name', e.name,
        'muscle_group', e.muscle_group,
        'type', e.type
      ) order by e.name)
      from athlete_exercises e
    ), '[]'::jsonb),
    'last_session', coalesce((
      select jsonb_build_object(
        'exercise_name', coalesce(l.exercise_name, l.exercise_id),
        'started_at', l.date,
        'total_reps', l.total_reps,
        'total_volume_kg', l.total_volume,
        'sets', coalesce((
          select jsonb_agg(jsonb_build_object(
            'set_number', item.ordinality,
            'reps', item.value->>'reps',
            'weight_kg', coalesce(item.value->>'weight_kg', item.value->>'weight')
          ) order by item.ordinality)
          from jsonb_array_elements(l.sets) with ordinality as item(value, ordinality)
        ), '[]'::jsonb)
      )
      from latest_log l
    ), '{}'::jsonb),
    'prs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'exercise_name', grouped.exercise_name,
        'max_weight_kg', grouped.max_weight_kg,
        'max_reps', grouped.max_reps,
        'max_volume_kg', grouped.max_volume_kg
      ) order by grouped.exercise_name)
      from (
        select
          coalesce(ex.exercise_name, ex.exercise_id) as exercise_name,
          max(case
            when coalesce(ex.set_value->>'weight_kg', ex.set_value->>'weight') ~ '^[0-9]+([.][0-9]+)?$'
            then coalesce(ex.set_value->>'weight_kg', ex.set_value->>'weight')::numeric
          end) as max_weight_kg,
          max(case
            when ex.set_value->>'reps' ~ '^[0-9]+$' then (ex.set_value->>'reps')::integer
          end) as max_reps,
          max(ex.total_volume) as max_volume_kg
        from expanded_sets ex
        group by ex.exercise_id, ex.exercise_name
      ) grouped
    ), '[]'::jsonb),
    'volume_history', coalesce((
      select jsonb_agg(jsonb_build_object(
        'date', l.date,
        'exercise_name', coalesce(l.exercise_name, l.exercise_id),
        'total_volume_kg', l.total_volume
      ) order by l.date asc)
      from recent_volume l
    ), '[]'::jsonb),
    'synced_at', coalesce(
      (select max(date) from athlete_logs),
      (select coalesce(rotated_at, created_at) from share)
    )
  ) else null end;
$$;

revoke all on function public.get_coach_data(uuid) from public;
grant execute on function public.get_coach_data(uuid) to anon, authenticated;

-- ── Indexes and grants ──────────────────────────────────────────────────────

create index if not exists idx_exercise_logs_user_date on public.exercise_logs(user_id, date desc);
create index if not exists idx_exercise_logs_user_exercise_date on public.exercise_logs(user_id, exercise_id, date desc);
create index if not exists idx_workout_plans_user on public.workout_plans(user_id);
create index if not exists idx_coach_shares_enabled_token on public.coach_shares(token) where enabled = true;
create index if not exists idx_coach_workout_sessions_user_started on public.coach_workout_sessions(user_id, local_started_at desc);
create index if not exists idx_coach_workout_sessions_user_active on public.coach_workout_sessions(user_id, local_started_at desc) where status = 'active' and local_ended_at is null;
create index if not exists idx_coaching_messages_user_created on public.coaching_messages(user_id, created_at desc);
create index if not exists idx_coaching_messages_session_created on public.coaching_messages(session_id, created_at desc);
create index if not exists idx_coaching_messages_log_set on public.coaching_messages(exercise_log_id, set_index);
create unique index if not exists idx_coaching_messages_log_client_set_unique on public.coaching_messages(exercise_log_id, client_set_id) where client_set_id is not null;
create unique index if not exists idx_coaching_messages_log_fingerprint_unique on public.coaching_messages(exercise_log_id, set_fingerprint) where set_fingerprint is not null;

grant select, insert, update, delete on table
  public.exercises,
  public.workout_plans,
  public.exercise_logs,
  public.user_settings,
  public.workout_timer_state,
  public.active_sessions,
  public.coach_shares,
  public.coach_workout_sessions,
  public.coaching_messages
  to authenticated;
