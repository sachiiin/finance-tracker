-- Run this once if you already ran schema.sql before job start/end dates were added.
alter table public.jobs add column if not exists start_date date;
alter table public.jobs add column if not exists end_date date;
