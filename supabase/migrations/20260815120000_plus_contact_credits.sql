-- Tenant Plus contact credit wallet (idempotent).
alter table public.profiles
  add column if not exists plus_contact_credits integer not null default 0;

comment on column public.profiles.plus_contact_credits is
  'Remaining Tenant Plus contact-unlock credits for the current paid period.';

-- Seed existing Plus members so they are not stuck at 0 after this ships.
update public.profiles
set plus_contact_credits = 10
where tenant_plan = 'plus'
  and plus_contact_credits = 0;
