-- Accounts (chequing, credit cards, cash), everyday expenses and credit card payments.
-- Run once in SQL Editor (role = postgres). Safe to run more than once.

create table if not exists public.accounts (
  id            bigint generated always as identity primary key,
  user_id       uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name          text not null,
  kind          text not null default 'chequing' check (kind in ('chequing', 'savings', 'credit_card', 'cash')),
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
