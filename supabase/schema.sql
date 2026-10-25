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

-- ───────────────────────── Settings ─────────────────────────
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
alter table public.settings add column if not exists display_name text;

-- ─────────────── Accounts, expenses, card payments ───────────────

create table if not exists public.accounts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  kind          text not null default 'chequing',
  methods       text[] not null default '{}',     -- e.g. {Interac,UPI} or {Card}
  balance       numeric(12, 2),                    -- you update it; for a credit card = amount owed
  balance_date  date,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create table if not exists public.expenses (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expense_date  date not null,
  description   text not null,
  category      text,
  amount        numeric(12, 2) not null check (amount >= 0),
  account_id    bigint not null references public.accounts (id) on delete restrict,
  method        text,
  created_at    timestamptz not null default now()
);

-- Paying a credit card bill: a transfer, not spending (so it is never counted twice)
create table if not exists public.card_payments (
  id               bigint generated always as identity primary key,
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  payment_date     date not null,
  from_account_id  bigint references public.accounts (id) on delete restrict,
  to_account_id    bigint not null references public.accounts (id) on delete restrict,
  amount           numeric(12, 2) not null check (amount >= 0),
  method           text,                           -- Auto Pay / Manual
  note             text,
  created_at       timestamptz not null default now()
);

-- Which account / payment method money went out of (or came into)
alter table public.india_payments  add column if not exists account_id bigint references public.accounts (id) on delete set null;
alter table public.india_payments  add column if not exists method text;
alter table public.donations       add column if not exists account_id bigint references public.accounts (id) on delete set null;
alter table public.donations       add column if not exists method text;
alter table public.loans           add column if not exists account_id bigint references public.accounts (id) on delete set null;
alter table public.loans           add column if not exists method text;
alter table public.loan_repayments add column if not exists account_id bigint references public.accounts (id) on delete set null;
alter table public.loan_repayments add column if not exists method text;

do $$
declare t text;
begin
  foreach t in array array['accounts', 'expenses', 'card_payments']
  loop
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

create index if not exists expenses_account_idx on public.expenses (account_id);
create index if not exists card_payments_from_idx on public.card_payments (from_account_id);
create index if not exists card_payments_to_idx on public.card_payments (to_account_id);

-- Account types (also applied to databases created before savings was added)
alter table public.accounts drop constraint if exists accounts_kind_check;
alter table public.accounts add constraint accounts_kind_check
  check (kind in ('chequing', 'savings', 'credit_card', 'cash'));
