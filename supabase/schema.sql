-- ============================================================================
--  Finance Tracker – complete database setup (one file, for a new project)
-- ============================================================================
--  How to run:
--    Supabase → SQL Editor → New query → paste this whole file → Run.
--    (Role selector: postgres, the default.)
--
--  What it creates (11 tables, all private to the signed-in user):
--    accounts         chequing, savings, credit cards, cash
--    jobs, paystubs   jobs and their pay stubs (net pay, hours, Bhaag %)
--    other_income     CRA benefits, refunds, other money received
--    donations        Bhaag (10%/20%) given
--    india_payments   money sent to India (CAD → INR)
--    expenses         everyday spending
--    card_payments    paying credit card bills (not counted as spending)
--    loans, loan_repayments   money lent to people and what came back
--    settings         per-user name and India loan amount
--
--  Security: Row Level Security is on for every table, so each signed-in user
--  can only read and change their own rows. Signed-out visitors (anon) get no
--  access at all.
--
--  Safe to run more than once: nothing is dropped and no data is changed.
-- ============================================================================


-- ──────────────────────────────── Accounts ────────────────────────────────

create table if not exists public.accounts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  kind          text not null default 'chequing'
                check (kind in ('chequing', 'savings', 'credit_card', 'cash')),
  methods       text[] not null default '{}',     -- payment methods, e.g. {Interac,UPI} or {Card}
  balance       numeric(12, 2),                    -- you update it; for a credit card = amount owed
  balance_date  date,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);


-- ──────────────────────────────── Comes in ────────────────────────────────

create table if not exists public.jobs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title       text not null,                       -- e.g. QA Analyst
  employer    text not null,                       -- e.g. Acme Ltd.
  location    text,
  job_type    text not null default 'Full-time' check (job_type in ('Full-time', 'Part-time')),
  start_date  date,
  end_date    date,                                -- empty = still working there
  is_current  boolean not null default false,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

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
  account_id     bigint references public.accounts (id) on delete set null,   -- deposited to
  created_at     timestamptz not null default now()
);

create table if not exists public.other_income (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  description    text not null,                    -- e.g. CRA GST/HST credit
  date_received  date not null,
  amount         numeric(12, 2) not null check (amount >= 0),
  bhaag_percent  numeric(5, 2) not null default 10 check (bhaag_percent between 0 and 100),
  account_id     bigint references public.accounts (id) on delete set null,   -- deposited to
  created_at     timestamptz not null default now()
);


-- ──────────────────────────────── Goes out ────────────────────────────────

-- Bhaag owed is calculated by the app from paystubs + other_income (bhaag_percent).
-- This table records what was actually given.
create table if not exists public.donations (
  id             bigint generated always as identity primary key,
  user_id        uuid not null default auth.uid() references auth.users (id) on delete cascade,
  donation_date  date not null,
  description    text,
  amount         numeric(12, 2) not null check (amount >= 0),
  account_id     bigint references public.accounts (id) on delete set null,   -- paid from
  method         text,
  created_at     timestamptz not null default now()
);

create table if not exists public.india_payments (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  payment_date  date not null,
  cad_amount    numeric(12, 2) not null check (cad_amount >= 0),
  ca_account    text,                              -- older free-text account (kept for old rows)
  rate          numeric(10, 4) not null check (rate > 0),   -- INR per CAD (the app saves 2 decimals)
  inr_amount    numeric(14, 2) not null check (inr_amount >= 0),
  comments      text,
  account_id    bigint references public.accounts (id) on delete set null,    -- sent from
  method        text,
  created_at    timestamptz not null default now()
);

create table if not exists public.expenses (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  expense_date  date not null,
  description   text not null,
  category      text,
  amount        numeric(12, 2) not null check (amount >= 0),
  account_id    bigint not null references public.accounts (id) on delete restrict,   -- paid from
  method        text,
  created_at    timestamptz not null default now()
);

-- Paying a credit card bill is a transfer, not spending (so nothing is counted twice)
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


-- ─────────────────────────────── Money lent ───────────────────────────────

create table if not exists public.loans (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name         text not null,
  description  text,
  amount       numeric(12, 2) not null check (amount >= 0),
  due_date     date,
  account_id   bigint references public.accounts (id) on delete set null,    -- given from
  method       text,
  created_at   timestamptz not null default now()
);

create table if not exists public.loan_repayments (
  id           bigint generated always as identity primary key,
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  loan_id      bigint not null references public.loans (id) on delete cascade,
  repaid_date  date not null,
  amount       numeric(12, 2) not null check (amount >= 0),
  note         text,
  account_id   bigint references public.accounts (id) on delete set null,    -- received into
  method       text,
  created_at   timestamptz not null default now()
);


-- ──────────────────────────────── Settings ────────────────────────────────

create table if not exists public.settings (
  user_id         uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  display_name    text,                            -- shown in the top bar instead of the email
  india_loan_inr  numeric(14, 2) check (india_loan_inr >= 0),
  updated_at      timestamptz not null default now()
);


-- ─────────────────────── Access rules (RLS + grants) ───────────────────────
-- Supabase does not grant Data API access to new tables automatically, so each
-- table is granted to signed-in users (authenticated) and server tools
-- (service_role) only. Row Level Security limits every row to its owner.

do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'jobs', 'paystubs', 'other_income', 'donations', 'india_payments',
    'expenses', 'card_payments', 'loans', 'loan_repayments', 'settings']
  loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant select, insert, update, delete on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "own rows" on public.%I', t);
    execute format(
      'create policy "own rows" on public.%I for all to authenticated
         using (user_id = (select auth.uid()))
         with check (user_id = (select auth.uid()))', t);
    if t <> 'settings' then   -- settings.user_id is already the primary key
      execute format('create index if not exists %I on public.%I (user_id)', t || '_user_idx', t);
    end if;
  end loop;
end $$;


-- ──────────────────────────── Lookup indexes ─────────────────────────────

create index if not exists paystubs_job_idx          on public.paystubs (job_id);
create index if not exists loan_repayments_loan_idx  on public.loan_repayments (loan_id);
create index if not exists expenses_account_idx      on public.expenses (account_id);
create index if not exists card_payments_from_idx    on public.card_payments (from_account_id);
create index if not exists card_payments_to_idx      on public.card_payments (to_account_id);


-- Done. Check: should list 11 tables, all with rls_on = true.
select relname as table_name, relrowsecurity as rls_on
from pg_class
where relnamespace = 'public'::regnamespace and relkind = 'r'
order by 1;
