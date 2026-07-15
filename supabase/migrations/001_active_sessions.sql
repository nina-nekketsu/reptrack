-- Dedicated cross-device active-workout lifecycle state.
-- Apply through the normal Supabase migration path; do not run ad hoc in production.

create table if not exists public.active_sessions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  session jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.active_sessions enable row level security;

drop policy if exists "active_sessions_select_own" on public.active_sessions;
create policy "active_sessions_select_own"
  on public.active_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "active_sessions_insert_own" on public.active_sessions;
create policy "active_sessions_insert_own"
  on public.active_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "active_sessions_update_own" on public.active_sessions;
create policy "active_sessions_update_own"
  on public.active_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

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

  -- Serialize merges for this user, including the first insert where no row
  -- exists yet and SELECT ... FOR UPDATE alone cannot acquire a row lock.
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
