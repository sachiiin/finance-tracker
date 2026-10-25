-- Allows "savings" as an account type. Run once (role = postgres). Safe to run more than once.
alter table public.accounts drop constraint if exists accounts_kind_check;
alter table public.accounts add constraint accounts_kind_check
  check (kind in ('chequing', 'savings', 'credit_card', 'cash'));
