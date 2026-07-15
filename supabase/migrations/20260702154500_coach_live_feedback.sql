create table if not exists coach_workout_sessions (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  local_started_at timestamptz not null,
  local_ended_at   timestamptz,
  status           text not null default 'active',
  metadata         jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint coach_workout_sessions_status_check
    check (status in ('active', 'completed', 'cancelled')),
  constraint coach_workout_sessions_user_local_started_unique
    unique (user_id, local_started_at)
);
alter table coach_workout_sessions enable row level security;
drop policy if exists "Users see own coach workout sessions" on coach_workout_sessions;
create policy "Users see own coach workout sessions"
  on coach_workout_sessions for select
  using (auth.uid() = user_id);
drop policy if exists "Users insert own coach workout sessions" on coach_workout_sessions;
create policy "Users insert own coach workout sessions"
  on coach_workout_sessions for insert
  with check (auth.uid() = user_id);
drop policy if exists "Users update own coach workout sessions" on coach_workout_sessions;
create policy "Users update own coach workout sessions"
  on coach_workout_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create table if not exists coaching_messages (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  session_id         uuid not null references coach_workout_sessions(id) on delete cascade,
  exercise_log_id    uuid not null references exercise_logs(id) on delete cascade,
  exercise_id        text not null,
  set_index          int,
  client_set_id      text,
  set_fingerprint    text,
  message            text not null,
  source             text not null default 'deterministic',
  provider           text,
  model              text,
  latency_ms         int,
  prompt             text,
  metadata           jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  constraint coaching_messages_source_check
    check (source in ('ai', 'deterministic'))
);
alter table coaching_messages enable row level security;
alter table coaching_messages
  add column if not exists latency_ms int;
drop policy if exists "Users see own coaching messages" on coaching_messages;
create policy "Users see own coaching messages"
  on coaching_messages for select
  using (auth.uid() = user_id);
create index if not exists idx_coach_workout_sessions_user_started
  on coach_workout_sessions(user_id, local_started_at desc);
create index if not exists idx_coach_workout_sessions_user_active
  on coach_workout_sessions(user_id, local_started_at desc)
  where status = 'active' and local_ended_at is null;
create index if not exists idx_coaching_messages_user_created
  on coaching_messages(user_id, created_at desc);
create index if not exists idx_coaching_messages_session_created
  on coaching_messages(session_id, created_at desc);
create index if not exists idx_coaching_messages_log_set
  on coaching_messages(exercise_log_id, set_index);
create unique index if not exists idx_coaching_messages_log_client_set_unique
  on coaching_messages(exercise_log_id, client_set_id)
  where client_set_id is not null;
create unique index if not exists idx_coaching_messages_log_fingerprint_unique
  on coaching_messages(exercise_log_id, set_fingerprint)
  where set_fingerprint is not null;
