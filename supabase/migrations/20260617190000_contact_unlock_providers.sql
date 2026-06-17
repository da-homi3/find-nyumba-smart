-- Contact unlock fees, tenant trial, provider marketplace, subscription trials

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS trial_unlocks_remaining INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS trial_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS contact_phone TEXT;

CREATE TABLE IF NOT EXISTS public.contact_unlocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  listing_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('trial', 'paid', 'plus')),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  fee_charged INTEGER NOT NULL DEFAULT 0 CHECK (fee_charged >= 0),
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, listing_id)
);

CREATE INDEX IF NOT EXISTS idx_contact_unlocks_user ON public.contact_unlocks (user_id);

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check CHECK (
    status IN ('active', 'cancelled', 'past_due', 'trialing')
  );

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_payment_type_check;
ALTER TABLE public.payments
  ADD CONSTRAINT payments_payment_type_check CHECK (
    payment_type IN (
      'featured_listing',
      'premium_subscription',
      'property_boost',
      'tenant_plus',
      'lead_pack',
      'verification',
      'report',
      'invoice',
      'landlord_plan',
      'contact_unlock',
      'provider_subscription'
    )
  );

CREATE TABLE IF NOT EXISTS public.service_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  categories JSONB NOT NULL DEFAULT '[]',
  areas_served JSONB NOT NULL DEFAULT '[]',
  description TEXT,
  price_range TEXT,
  phone TEXT NOT NULL,
  photo_url TEXT,
  tier TEXT NOT NULL DEFAULT 'basic' CHECK (tier IN ('basic', 'featured', 'premium')),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'suspended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_service_providers_user ON public.service_providers (user_id);
CREATE INDEX IF NOT EXISTS idx_service_providers_status ON public.service_providers (status);

CREATE TABLE IF NOT EXISTS public.provider_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES public.service_providers(id) ON DELETE CASCADE,
  tenant_user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.contact_unlocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provider_inquiries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own contact unlocks" ON public.contact_unlocks;
CREATE POLICY "Users read own contact unlocks" ON public.contact_unlocks
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Public read active providers" ON public.service_providers;
CREATE POLICY "Public read active providers" ON public.service_providers
  FOR SELECT USING (status = 'active');

DROP POLICY IF EXISTS "Owners manage own provider profile" ON public.service_providers;
CREATE POLICY "Owners manage own provider profile" ON public.service_providers
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Tenants read own provider inquiries" ON public.provider_inquiries;
CREATE POLICY "Tenants read own provider inquiries" ON public.provider_inquiries
  FOR SELECT USING (auth.uid() = tenant_user_id);

DROP POLICY IF EXISTS "Providers read inquiries for their business" ON public.provider_inquiries;
CREATE POLICY "Providers read inquiries for their business" ON public.provider_inquiries
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.service_providers sp
      WHERE sp.id = provider_id AND sp.user_id = auth.uid()
    )
  );

-- Retroactive trial for existing tenant profiles
UPDATE public.profiles
SET
  trial_unlocks_remaining = 3,
  trial_started_at = COALESCE(trial_started_at, NOW()),
  trial_ends_at = COALESCE(trial_ends_at, NOW() + INTERVAL '14 days')
WHERE trial_started_at IS NULL;
