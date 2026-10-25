-- Run in Supabase → SQL Editor only after everyone has signed in to the new app once (that is when their data is
-- brought over from public.user_data). Until then, keep user_data.

-- Bank-link tokens from an old Plaid experiment: nothing uses them.
drop table if exists public.linked_accounts;

-- The previous app's data. Every person's notebook now lives in public.app_state.
-- drop table if exists public.user_data;   -- uncomment when you're sure everyone has moved over
