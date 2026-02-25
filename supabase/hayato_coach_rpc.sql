-- RepTrack — Hayato Coach RPC
-- SECURITY DEFINER function that returns detailed workout data for coaching.
-- Callable with anon key (no auth needed), uses a secret coach key for access.
-- Run this in the Supabase SQL editor.

-- Create a config table for the coach API key
create table if not exists coach_api_config (
  id int primary key default 1 check (id = 1),  -- singleton
  api_key uuid not null default gen_random_uuid(),
  created_at timestamptz default now()
);

-- Insert the singleton row (generates a random API key)
insert into coach_api_config (id) values (1) on conflict do nothing;

-- Lock it down — no one can read this table via the API
alter table coach_api_config enable row level security;
-- No policies = no access via API. Only SECURITY DEFINER functions can read it.

-- ═══════════════════════════════════════════════════════════════════════════
-- get_coach_workout_data(p_api_key, p_command, p_args)
-- 
-- Commands:
--   'recent'          — Last N sessions with sets (p_args: { "limit": 5 })
--   'exercise'        — History for exercise (p_args: { "name": "...", "limit": 10 })
--   'prs'             — Personal records per exercise
--   'last_session'    — Most recent session in detail
--   'compare'         — Compare last 2 sessions (p_args: { "name": "..." })
--   'all_exercises'   — List all exercises
--   'weekly_summary'  — This week's totals
--   'active_check'    — Is there an active workout right now?
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function get_coach_workout_data(
  p_api_key uuid,
  p_command text default 'recent',
  p_args jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_valid boolean;
  v_user_id uuid;
  v_result jsonb;
  v_limit int;
  v_name text;
begin
  -- Validate API key
  select exists(select 1 from coach_api_config where api_key = p_api_key) into v_valid;
  if not v_valid then
    return jsonb_build_object('error', 'Invalid API key');
  end if;

  -- Get the first user (single-user app)
  select id into v_user_id from auth.users limit 1;
  if v_user_id is null then
    return jsonb_build_object('error', 'No user found');
  end if;

  -- Parse common args
  v_limit := coalesce((p_args->>'limit')::int, 5);
  v_name := p_args->>'name';

  case p_command

  -- ── RECENT SESSIONS ──────────────────────────────────────────────────
  when 'recent' then
    select coalesce(jsonb_agg(session_data order by started_at desc), '[]'::jsonb)
    into v_result
    from (
      select 
        es.started_at,
        e.name as exercise_name,
        e.muscle_group,
        es.total_reps,
        es.total_volume_kg,
        (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'set_number', exs.set_number,
              'reps', exs.reps,
              'weight_kg', exs.weight_kg
            ) order by exs.set_number
          ), '[]'::jsonb)
          from exercise_sets exs where exs.session_id = es.id
        ) as sets,
        jsonb_build_object(
          'exercise_name', e.name,
          'started_at', es.started_at,
          'total_reps', es.total_reps,
          'total_volume_kg', es.total_volume_kg
        ) as session_data
      from exercise_sessions es
      join exercises e on e.local_id = es.local_exercise_id and e.user_id = v_user_id
      where es.user_id = v_user_id
      order by es.started_at desc
      limit v_limit
    ) sub;

    -- Re-query with sets included
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'exercise_name', sub.exercise_name,
        'muscle_group', sub.muscle_group,
        'started_at', sub.started_at,
        'total_reps', sub.total_reps,
        'total_volume_kg', sub.total_volume_kg,
        'sets', sub.sets
      ) order by sub.started_at desc
    ), '[]'::jsonb)
    into v_result
    from (
      select 
        e.name as exercise_name,
        e.muscle_group,
        es.started_at,
        es.total_reps,
        es.total_volume_kg,
        (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'set_number', exs.set_number,
              'reps', exs.reps,
              'weight_kg', exs.weight_kg
            ) order by exs.set_number
          ), '[]'::jsonb)
          from exercise_sets exs where exs.session_id = es.id
        ) as sets
      from exercise_sessions es
      join exercises e on e.local_id = es.local_exercise_id and e.user_id = v_user_id
      where es.user_id = v_user_id
      order by es.started_at desc
      limit v_limit
    ) sub;

  -- ── EXERCISE HISTORY ─────────────────────────────────────────────────
  when 'exercise' then
    if v_name is null then
      return jsonb_build_object('error', 'Missing "name" in args');
    end if;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'exercise_name', e.name,
        'started_at', es.started_at,
        'total_reps', es.total_reps,
        'total_volume_kg', es.total_volume_kg,
        'sets', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'set_number', exs.set_number,
              'reps', exs.reps,
              'weight_kg', exs.weight_kg
            ) order by exs.set_number
          ), '[]'::jsonb)
          from exercise_sets exs where exs.session_id = es.id
        )
      ) order by es.started_at desc
    ), '[]'::jsonb)
    into v_result
    from exercise_sessions es
    join exercises e on e.local_id = es.local_exercise_id and e.user_id = v_user_id
    where es.user_id = v_user_id
      and lower(e.name) like '%' || lower(v_name) || '%'
    order by es.started_at desc
    limit v_limit;

  -- ── PERSONAL RECORDS ─────────────────────────────────────────────────
  when 'prs' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'exercise_name', sub.name,
        'muscle_group', sub.muscle_group,
        'max_weight_kg', sub.max_weight,
        'max_reps', sub.max_reps,
        'max_set_volume', sub.max_set_vol,
        'total_sessions', sub.session_count
      ) order by sub.name
    ), '[]'::jsonb)
    into v_result
    from (
      select 
        e.name,
        e.muscle_group,
        max(exs.weight_kg) as max_weight,
        max(exs.reps) as max_reps,
        max(exs.reps * exs.weight_kg) as max_set_vol,
        count(distinct es.id) as session_count
      from exercises e
      join exercise_sessions es on es.local_exercise_id = e.local_id and es.user_id = v_user_id
      join exercise_sets exs on exs.session_id = es.id
      where e.user_id = v_user_id
      group by e.name, e.muscle_group
    ) sub;

  -- ── LAST SESSION ─────────────────────────────────────────────────────
  when 'last_session' then
    select jsonb_build_object(
      'exercise_name', e.name,
      'muscle_group', e.muscle_group,
      'started_at', es.started_at,
      'total_reps', es.total_reps,
      'total_volume_kg', es.total_volume_kg,
      'sets', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'set_number', exs.set_number,
            'reps', exs.reps,
            'weight_kg', exs.weight_kg
          ) order by exs.set_number
        ), '[]'::jsonb)
        from exercise_sets exs where exs.session_id = es.id
      )
    )
    into v_result
    from exercise_sessions es
    join exercises e on e.local_id = es.local_exercise_id and e.user_id = v_user_id
    where es.user_id = v_user_id
    order by es.started_at desc
    limit 1;

  -- ── COMPARE LAST 2 ───────────────────────────────────────────────────
  when 'compare' then
    if v_name is null then
      return jsonb_build_object('error', 'Missing "name" in args');
    end if;

    select coalesce(jsonb_agg(
      jsonb_build_object(
        'started_at', es.started_at,
        'total_reps', es.total_reps,
        'total_volume_kg', es.total_volume_kg,
        'sets', (
          select coalesce(jsonb_agg(
            jsonb_build_object(
              'set_number', exs.set_number,
              'reps', exs.reps,
              'weight_kg', exs.weight_kg
            ) order by exs.set_number
          ), '[]'::jsonb)
          from exercise_sets exs where exs.session_id = es.id
        )
      ) order by es.started_at desc
    ), '[]'::jsonb)
    into v_result
    from exercise_sessions es
    join exercises e on e.local_id = es.local_exercise_id and e.user_id = v_user_id
    where es.user_id = v_user_id
      and lower(e.name) like '%' || lower(v_name) || '%'
    order by es.started_at desc
    limit 2;

  -- ── ALL EXERCISES ────────────────────────────────────────────────────
  when 'all_exercises' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'name', e.name,
        'muscle_group', e.muscle_group,
        'type', e.exercise_type
      ) order by e.muscle_group, e.name
    ), '[]'::jsonb)
    into v_result
    from exercises e
    where e.user_id = v_user_id;

  -- ── WEEKLY SUMMARY ───────────────────────────────────────────────────
  when 'weekly_summary' then
    select jsonb_build_object(
      'week_start', date_trunc('week', now()),
      'total_sessions', count(distinct es.id),
      'total_volume_kg', coalesce(sum(es.total_volume_kg), 0),
      'total_reps', coalesce(sum(es.total_reps), 0),
      'exercises_trained', count(distinct e.name),
      'muscle_groups_hit', (
        select jsonb_agg(distinct e2.muscle_group)
        from exercise_sessions es2
        join exercises e2 on e2.local_id = es2.local_exercise_id and e2.user_id = v_user_id
        where es2.user_id = v_user_id
          and es2.started_at >= date_trunc('week', now())
      )
    )
    into v_result
    from exercise_sessions es
    join exercises e on e.local_id = es.local_exercise_id and e.user_id = v_user_id
    where es.user_id = v_user_id
      and es.started_at >= date_trunc('week', now());

  else
    return jsonb_build_object('error', 'Unknown command: ' || p_command);
  end case;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

-- Grant execute to anon (Hayato calls without auth)
grant execute on function get_coach_workout_data(uuid, text, jsonb) to anon, authenticated;

-- ── Output the generated API key so we can save it ──────────────────────
select api_key as "COACH_API_KEY — Save this!" from coach_api_config;
