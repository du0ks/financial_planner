-- Prosperity: one row per person with their whole notebook (web/js/p-cloud.js).
-- Run once in Supabase → SQL Editor. Safe to run again.

create table if not exists public.app_state (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  data       jsonb       not null,
  rev        bigint      not null default 1,   -- every save is "write if still at the revision I last saw"
  updated_at timestamptz not null default now()
);

alter table public.app_state enable row level security;

-- each signed-in person reads and writes only their own row; nobody else, signed in or not, sees it
drop policy if exists "own notebook" on public.app_state;
create policy "own notebook" on public.app_state
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

revoke all on public.app_state from anon;
grant select, insert, update, delete on public.app_state to authenticated;
