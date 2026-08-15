alter table public.financial_partners
  add column if not exists eligibility text;
