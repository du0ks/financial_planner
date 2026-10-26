-- Earlier versions of each notebook, so a change that was overwritten can be brought back.
-- Every save to app_state keeps the version it replaced here: the last 30 days, and at most 500 versions a person.
-- Each person can read only their own; only the trigger writes. Run once in the Supabase SQL Editor.

create table if not exists public.app_state_history (
  id bigserial primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  rev bigint not null,
  data jsonb not null,
  saved_at timestamptz not null
);
create index if not exists app_state_history_user on public.app_state_history (user_id, rev desc);

alter table public.app_state_history enable row level security;
drop policy if exists "own history" on public.app_state_history;
create policy "own history" on public.app_state_history for select to authenticated
  using (auth.uid() = user_id);
revoke all on public.app_state_history from anon, authenticated;
grant select on public.app_state_history to authenticated;

create or replace function public.keep_app_state_version() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.data is distinct from new.data then
    insert into app_state_history (user_id, rev, data, saved_at) values (old.user_id, old.rev, old.data, old.updated_at);
    delete from app_state_history
      where user_id = old.user_id
        and (saved_at < now() - interval '30 days'
             or id not in (select id from app_state_history where user_id = old.user_id order by id desc limit 500));
  end if;
  return new;
end $$;

drop trigger if exists keep_version on public.app_state;
create trigger keep_version before update on public.app_state
  for each row execute function public.keep_app_state_version();
