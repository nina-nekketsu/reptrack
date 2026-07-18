-- R13/R15/R16: additive coach-share contract for the current flat JSONB model.
-- REVIEW ONLY. Do not apply to an existing project until a read-only schema
-- comparison has been completed and Lloyd has approved this exact migration.

begin;

alter table if exists public.coach_shares
  add column if not exists rotated_at timestamptz;

create unique index if not exists idx_coach_shares_user_unique
  on public.coach_shares(user_id);
create unique index if not exists idx_coach_shares_token_unique
  on public.coach_shares(token);
create index if not exists idx_coach_shares_enabled_token
  on public.coach_shares(token) where enabled = true;

-- A token resolves its owner explicitly through coach_shares.user_id. The RPC
-- reads the app's authoritative exercise_logs JSONB rows, never the obsolete
-- exercise_sessions/exercise_sets model and never an arbitrary auth.users row.
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

commit;
