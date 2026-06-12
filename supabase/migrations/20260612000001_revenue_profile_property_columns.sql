-- Profile + property columns for revenue (run if tables exist but columns missing)

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS landlord_plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS tenant_plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plus_expires_at TIMESTAMPTZ;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_package TEXT,
  ADD COLUMN IF NOT EXISTS nyumba_verified_at TIMESTAMPTZ;
