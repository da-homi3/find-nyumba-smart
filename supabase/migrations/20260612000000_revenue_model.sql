-- NyumbaSearch revenue model extensions

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS landlord_plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS tenant_plan TEXT NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS plus_expires_at TIMESTAMPTZ;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS boost_package TEXT,
  ADD COLUMN IF NOT EXISTS nyumba_verified_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  plan TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due')),
  amount_kes INTEGER NOT NULL CHECK (amount_kes >= 0),
  billing_cycle TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_cycle IN ('monthly', 'quarterly')),
  payment_method TEXT NOT NULL DEFAULT 'mpesa' CHECK (payment_method IN ('mpesa', 'card')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  next_billing_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.listing_boosts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  package TEXT NOT NULL CHECK (package IN ('spotlight', 'homepage', 'campaign')),
  start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  end_date TIMESTAMPTZ NOT NULL,
  amount_paid_kes INTEGER NOT NULL CHECK (amount_paid_kes > 0),
  placements TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.verification_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_address TEXT NOT NULL,
  listing_url TEXT,
  listing_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  requester_name TEXT NOT NULL,
  requester_phone TEXT NOT NULL,
  requester_email TEXT NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('basic', 'standard', 'express')),
  amount_paid_kes INTEGER NOT NULL CHECK (amount_paid_kes > 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in-progress', 'complete', 'failed')),
  report_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  quality_score SMALLINT NOT NULL DEFAULT 3 CHECK (quality_score BETWEEN 1 AND 5),
  source TEXT NOT NULL CHECK (source IN ('view', 'save', 'message', 'booking')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (listing_id, tenant_id, source)
);

CREATE TABLE IF NOT EXISTS public.rental_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tenant_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  rent_amount_kes INTEGER NOT NULL CHECK (rent_amount_kes > 0),
  platform_fee_kes INTEGER NOT NULL CHECK (platform_fee_kes >= 0),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'disputed')),
  transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  line_items JSONB NOT NULL DEFAULT '[]',
  total_kes INTEGER NOT NULL CHECK (total_kes >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'paid', 'void')),
  due_date TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
      'landlord_plan'
    )
  );

CREATE INDEX IF NOT EXISTS idx_listing_boosts_active ON public.listing_boosts (listing_id, end_date);
CREATE INDEX IF NOT EXISTS idx_properties_featured_until ON public.properties (featured_until);
CREATE INDEX IF NOT EXISTS idx_leads_landlord_month ON public.leads (landlord_id, created_at);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions (user_id, status);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rental_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own subscriptions" ON public.subscriptions;
CREATE POLICY "Users read own subscriptions" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own boosts" ON public.listing_boosts;
CREATE POLICY "Users read own boosts" ON public.listing_boosts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Landlords read own leads" ON public.leads;
CREATE POLICY "Landlords read own leads" ON public.leads
  FOR SELECT USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Users read own verification requests" ON public.verification_requests;
CREATE POLICY "Users read own verification requests" ON public.verification_requests
  FOR SELECT USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Landlords read own transactions" ON public.rental_transactions;
CREATE POLICY "Landlords read own transactions" ON public.rental_transactions
  FOR SELECT USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Users read own invoices" ON public.invoices;
CREATE POLICY "Users read own invoices" ON public.invoices
  FOR SELECT USING (auth.uid() = user_id);
