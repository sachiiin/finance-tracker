-- Sachin's Finance Tracker — Supabase schema
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Every table is protected by Row Level Security: a signed-in user can only
-- see and change their own rows (user_id is filled in automatically).

-- ───────────────────────── Comes In ─────────────────────────

create table if not exists public.jobs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,                       -- e.g. QA Analyst
  employer    text not null,                       -- e.g. Signifi Solutions Inc.
  location    text,                                -- e.g. Mississauga ON
  job_type    text not null default 'Full-time' check (job_type in ('Full-time', 'Part-time')),
  start_date  date,
  end_date    date,
  is_current  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- Added later: safe to run on a database that already has the jobs table.
alter table public.jobs add column if not exists start_date date;
alter table public.jobs add column if not exists end_date date;

create table if not exists public.paystubs (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  job_id         bigint not null references public.jobs (id) on delete restrict,
  period_start   date,
  period_end     date,
  pay_date       date not null,
  hours          numeric(8, 2),
  net_pay        numeric(12, 2) not null check (net_pay >= 0),
  bhaag_percent  numeric(5, 2) not null default 10 check (bhaag_percent between 0 and 100),
  created_at     timestamptz not null default now()
);

create table if not exists public.other_income (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description    text not null,                    -- e.g. CRA GST/HST credit
  date_received  date not null,
  amount         numeric(12, 2) not null check (amount >= 0),
  bhaag_percent  numeric(5, 2) not null default 10 check (bhaag_percent between 0 and 100),
  created_at     timestamptz not null default now()
);

-- ───────────────────────── Goes Out ─────────────────────────

-- Bhaag owed is calculated from paystubs + other_income (bhaag_percent).
-- This table records what was actually given to the temple.
create table if not exists public.donations (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  donation_date  date not null,
  description    text,
  amount         numeric(12, 2) not null check (amount >= 0),
  created_at     timestamptz not null default now()
);

create table if not exists public.india_payments (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  payment_date  date not null,
  cad_amount    numeric(12, 2) not null check (cad_amount >= 0),
  ca_account    text,                              -- Canadian account it was sent from
  rate          numeric(10, 4) not null check (rate > 0),
  inr_amount    numeric(14, 2) not null check (inr_amount >= 0),
  comments      text,
  created_at    timestamptz not null default now()
);

-- ──────────────────────── Money Lent ────────────────────────

create table if not exists public.loans (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  description  text,
  amount       numeric(12, 2) not null check (amount >= 0),
  due_date     date,
  created_at   timestamptz not null default now()
);

create table if not exists public.loan_repayments (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  loan_id      bigint not null references public.loans (id) on delete cascade,
  repaid_date  date not null,
  amount       numeric(12, 2) not null check (amount >= 0),
  note         text,
  created_at   timestamptz not null default now()
);

-- ───────────────────── Row Level Security ─────────────────────

do $$
declare t text;
begin
  foreach t in array array['jobs','paystubs','other_income','donations','india_payments','loans','loan_repayments']
  loop
    -- Explicit Data API grants (Supabase no longer grants these automatically
    -- for new tables in "public"). No grant to anon: the app is login-only.
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
  end loop;
end $$;

create index if not exists paystubs_job_idx on public.paystubs (job_id);
create index if not exists loan_repayments_loan_idx on public.loan_repayments (loan_id);
