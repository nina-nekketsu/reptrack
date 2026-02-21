-- RepTrack – Supabase Schema
-- Run this in the Supabase SQL editor of your project.
-- All tables use Row Level Security (RLS) so users only see their own rows.

-- ── Enable UUID extension ────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ────────────────────────────────────────────────────────────────────────────
-- exercises
-- local_id stores the client-side string id (e.g. 'e-slps', '1693...')
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists exercises (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  local_id      text not null,
  name          text not null,
  muscle_group  text,
  exercise_type text default 'Strength',
  created_at    timestamptz default now(),

  unique (user_id, local_id)
);

alter table exercises enable row level security;

create policy "Users see own exercises"
  on exercises for select using (auth.uid() = user_id);

create policy "Users insert own exercises"
  on exercises for insert with check (auth.uid() = user_id);

create policy "Users update own exercises"
  on exercises for update using (auth.uid() = user_id);

create policy "Users delete own exercises"
  on exercises for delete using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- exercise_sessions
-- One row per exercise logging event.
-- local_exercise_id mirrors the client-side exercise id string.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists exercise_sessions (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  local_exercise_id  text not null,
  started_at         timestamptz not null,
  total_reps         int,
  total_volume_kg    numeric,
  created_at         timestamptz default now()
);

alter table exercise_sessions enable row level security;

create policy "Users see own sessions"
  on exercise_sessions for select using (auth.uid() = user_id);

create policy "Users insert own sessions"
  on exercise_sessions for insert with check (auth.uid() = user_id);

create policy "Users update own sessions"
  on exercise_sessions for update using (auth.uid() = user_id);

create policy "Users delete own sessions"
  on exercise_sessions for delete using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- exercise_sets
-- Individual sets within a session.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists exercise_sets (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references exercise_sessions(id) on delete cascade,
  set_number  int not null,
  reps        int,
  weight_kg   numeric,
  created_at  timestamptz default now()
);

alter table exercise_sets enable row level security;

-- Sets inherit auth from their parent session via a join check
create policy "Users see own sets"
  on exercise_sets for select
  using (
    exists (
      select 1 from exercise_sessions s
      where s.id = exercise_sets.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users insert own sets"
  on exercise_sets for insert
  with check (
    exists (
      select 1 from exercise_sessions s
      where s.id = exercise_sets.session_id
        and s.user_id = auth.uid()
    )
  );

create policy "Users delete own sets"
  on exercise_sets for delete
  using (
    exists (
      select 1 from exercise_sessions s
      where s.id = exercise_sets.session_id
        and s.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- workout_plans
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists workout_plans (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  local_id   text not null,
  name       text not null,
  created_at timestamptz default now(),

  unique (user_id, local_id)
);

alter table workout_plans enable row level security;

create policy "Users see own plans"
  on workout_plans for select using (auth.uid() = user_id);

create policy "Users insert own plans"
  on workout_plans for insert with check (auth.uid() = user_id);

create policy "Users update own plans"
  on workout_plans for update using (auth.uid() = user_id);

create policy "Users delete own plans"
  on workout_plans for delete using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────────────────────
-- plan_exercises
-- Junction table: which exercises belong to which plan, in what order.
-- ────────────────────────────────────────────────────────────────────────────
create table if not exists plan_exercises (
  id                 uuid primary key default gen_random_uuid(),
  plan_id            uuid not null references workout_plans(id) on delete cascade,
  local_exercise_id  text not null,
  prescribed_sets    int not null default 3,
  prescribed_reps    int not null default 10,
  position           int not null default 0,
  created_at         timestamptz default now()
);

alter table plan_exercises enable row level security;

-- Auth check via parent plan
create policy "Users see own plan_exercises"
  on plan_exercises for select
  using (
    exists (
      select 1 from workout_plans p
      where p.id = plan_exercises.plan_id
        and p.user_id = auth.uid()
    )
  );

create policy "Users insert own plan_exercises"
  on plan_exercises for insert
  with check (
    exists (
      select 1 from workout_plans p
      where p.id = plan_exercises.plan_id
        and p.user_id = auth.uid()
    )
  );

create policy "Users delete own plan_exercises"
  on plan_exercises for delete
  using (
    exists (
      select 1 from workout_plans p
      where p.id = plan_exercises.plan_id
        and p.user_id = auth.uid()
    )
  );

-- ────────────────────────────────────────────────────────────────────────────
-- Indexes for common query patterns
-- ────────────────────────────────────────────────────────────────────────────
create index if not exists idx_exercises_user_id         on exercises(user_id);
create index if not exists idx_sessions_user_exercise    on exercise_sessions(user_id, local_exercise_id);
create index if not exists idx_sets_session_id           on exercise_sets(session_id);
create index if not exists idx_plans_user_id             on workout_plans(user_id);
create index if not exists idx_plan_exercises_plan_id    on plan_exercises(plan_id);
