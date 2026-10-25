-- Run this once if you already ran schema.sql before "show name instead of email" was added.
-- Safe to run more than once. Also creates the settings table if 002 was skipped.
create table if not exists public.settings (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  india_loan_inr  numeric(14, 2) check (india_loan_inr >= 0),
  updated_at      timestamptz not null default now()
);
alter table public.settings add column if not exists display_name text;

grant select, insert, update, delete on public.settings to authenticated;
grant select, insert, update, delete on public.settings to service_role;
alter table public.settings enable row level security;
drop policy if exists "own rows" on public.settings;
create policy "own rows" on public.settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
