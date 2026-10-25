-- Which account pay stubs and CRA / other income were deposited into.
-- Run once (role = postgres). Safe to run more than once. Needs 004 first.
alter table public.paystubs     add column if not exists account_id bigint references public.accounts (id) on delete set null;
alter table public.other_income add column if not exists account_id bigint references public.accounts (id) on delete set null;
