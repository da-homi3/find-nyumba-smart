create table if not exists public.platform_subscription_invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  audience text not null check (audience in ('landlord', 'manager', 'agency', 'provider')),
  plan_id text not null,
  invoice_number text not null unique,
  period_start date not null,
  period_end date not null,
  amount_kes integer not null check (amount_kes > 0),
  status text not null default 'open' check (status in ('open', 'paid', 'void')),
  pay_path text,
  demand_summary jsonb,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, audience, period_start)
);

create index if not exists platform_subscription_invoices_user_idx
  on public.platform_subscription_invoices (user_id, status);

alter table public.platform_subscription_invoices enable row level security;

create policy "owners read own invoices"
  on public.platform_subscription_invoices
  for select
  to authenticated
  using (auth.uid() = user_id);

grant select on public.platform_subscription_invoices to authenticated;
grant all on public.platform_subscription_invoices to service_role;
