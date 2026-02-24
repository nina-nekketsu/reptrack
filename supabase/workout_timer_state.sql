-- RepTrack – Persistent Timer State Table
-- Stores the current timer state per user for cross-device sync.
-- One row per user; upserted on every phase transition.

create table if not exists workout_timer_state (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  state       jsonb,           -- full timer state blob (null when idle)
  updated_at  timestamptz default now()
);

alter table workout_timer_state enable row level security;

create policy "Users see own timer state"
  on workout_timer_state for select using (auth.uid() = user_id);

create policy "Users insert own timer state"
  on workout_timer_state for insert with check (auth.uid() = user_id);

create policy "Users update own timer state"
  on workout_timer_state for update using (auth.uid() = user_id);

create policy "Users delete own timer state"
  on workout_timer_state for delete using (auth.uid() = user_id);
