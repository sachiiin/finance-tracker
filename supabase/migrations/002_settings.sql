-- Run this once if you already ran schema.sql before the India loan tracker was added.
-- Stores per-user settings (currently: total India education loan in INR).
create table if not exists public.settings (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  india_loan_inr  numeric(14, 2) check (india_loan_inr >= 0),
  updated_at      timestamptz not null default now()
);

grant select, insert, update, delete on public.settings to authenticated;
grant select, insert, update, delete on public.settings to service_role;
alter table public.settings enable row level security;
drop policy if exists "own rows" on public.settings;
create policy "own rows" on public.settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
