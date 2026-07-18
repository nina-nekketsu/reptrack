-- R18: separate owner-scoped coach state from whole-settings writes.
-- REVIEW ONLY. Applying this migration requires Lloyd's exact approval.

begin;

create table if not exists public.coach_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  state jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.coach_state enable row level security;

drop policy if exists "coach_state_select_own" on public.coach_state;
create policy "coach_state_select_own" on public.coach_state
  for select using (auth.uid() = user_id);

drop policy if exists "coach_state_insert_own" on public.coach_state;
create policy "coach_state_insert_own" on public.coach_state
  for insert with check (auth.uid() = user_id);

drop policy if exists "coach_state_update_own" on public.coach_state;
create policy "coach_state_update_own" on public.coach_state
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "coach_state_delete_own" on public.coach_state;
create policy "coach_state_delete_own" on public.coach_state
  for delete using (auth.uid() = user_id);

grant select, insert, update, delete on table public.coach_state to authenticated;

commit;
