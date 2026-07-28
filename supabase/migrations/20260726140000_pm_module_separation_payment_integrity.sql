-- PM module separation, off-app payment claims, append-only ledger, admin disputes

-- ── Subscriptions: independent marketplace vs property_management modules ─
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS module TEXT NOT NULL DEFAULT 'marketplace';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_module_check'
  ) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_module_check
      CHECK (module IN ('marketplace', 'property_management'));
  END IF;
END $$;

UPDATE public.subscriptions SET module = 'marketplace' WHERE module IS NULL OR module = '';

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_module_status
  ON public.subscriptions (user_id, module, status);

-- ── PM pricing tiers (unit-count based, independent of marketplace plans) ─
CREATE TABLE IF NOT EXISTS public.pm_pricing_tiers (
  id         TEXT PRIMARY KEY,
  tier_name  TEXT NOT NULL,
  max_units  INTEGER NOT NULL,
  price_kes  INTEGER NOT NULL CHECK (price_kes >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.pm_pricing_tiers (id, tier_name, max_units, price_kes) VALUES
  ('pm-starter', 'PM Starter', 10,  1500),
  ('pm-growth',  'PM Growth',  50,  4000),
  ('pm-scale',   'PM Scale',   -1,  9000)
ON CONFLICT (id) DO NOTHING;

-- ── Per-property PM feature gate ──────────────────────────────────────────
ALTER TABLE public.pm_properties
  ADD COLUMN IF NOT EXISTS pm_module_active BOOLEAN NOT NULL DEFAULT false;

-- Grandfather existing managed properties so early adopters keep access
UPDATE public.pm_properties
SET pm_module_active = true
WHERE deleted_at IS NULL AND pm_module_active = false;

-- ── Off-app payment claims (immutable claim log; not yet credited) ────────
CREATE TABLE IF NOT EXISTS public.pm_rent_payment_claims (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id           UUID NOT NULL REFERENCES public.pm_rent_invoices(id) ON DELETE CASCADE,
  tenant_id            UUID NOT NULL REFERENCES public.pm_tenants(id) ON DELETE CASCADE,
  amount_claimed       INTEGER NOT NULL CHECK (amount_claimed > 0),
  method               TEXT NOT NULL CHECK (method IN (
    'cash', 'bank_transfer', 'mpesa_direct_to_landlord', 'other'
  )),
  paid_on_date         DATE NOT NULL,
  note                 TEXT,
  attachment_url       TEXT,
  status               TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'confirmed', 'disputed', 'withdrawn'
  )),
  submitted_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at          TIMESTAMPTZ,
  resolved_by_user_id  UUID REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_pm_claims_invoice
  ON public.pm_rent_payment_claims (invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_pm_claims_tenant
  ON public.pm_rent_payment_claims (tenant_id);

ALTER TABLE public.pm_rent_payment_claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_claims_select ON public.pm_rent_payment_claims;
CREATE POLICY pm_claims_select ON public.pm_rent_payment_claims
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pm_tenants t
      WHERE t.id = tenant_id AND t.tenant_user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.pm_rent_invoices i
      JOIN public.pm_leases l ON l.id = i.lease_id
      JOIN public.pm_units u ON u.id = l.unit_id
      WHERE i.id = invoice_id AND public.pm_user_can_access_property(u.property_id)
    )
  );

GRANT SELECT ON public.pm_rent_payment_claims TO authenticated;
GRANT ALL ON public.pm_rent_payment_claims TO service_role;

-- ── Append-only payment ledger fields + allow negative reversal amounts ───
ALTER TABLE public.pm_rent_payments
  ADD COLUMN IF NOT EXISTS source_claim_id UUID REFERENCES public.pm_rent_payment_claims(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_reversal BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reversal_of_payment_id UUID REFERENCES public.pm_rent_payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reversal_reason TEXT;

ALTER TABLE public.pm_rent_payments DROP CONSTRAINT IF EXISTS pm_rent_payments_amount_check;
ALTER TABLE public.pm_rent_payments
  ADD CONSTRAINT pm_rent_payments_amount_check CHECK (amount <> 0);

-- Append-only at the role layer: authenticated may insert/select, not update/delete
REVOKE UPDATE, DELETE ON public.pm_rent_payments FROM authenticated;

-- ── Admin dispute queue ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_dispute_queue (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispute_type         TEXT NOT NULL,
  related_id           UUID NOT NULL,
  reason               TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolution_outcome   TEXT,
  resolution_notes     TEXT,
  resolved_by_user_id  UUID REFERENCES public.profiles(id),
  resolved_at          TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_disputes_open
  ON public.admin_dispute_queue (status, created_at)
  WHERE status = 'open';

ALTER TABLE public.admin_dispute_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS admin_disputes_admin_all ON public.admin_dispute_queue;
CREATE POLICY admin_disputes_admin_all ON public.admin_dispute_queue
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.admin_dispute_queue TO authenticated;
GRANT ALL ON public.admin_dispute_queue TO service_role;

GRANT SELECT ON public.pm_pricing_tiers TO authenticated, anon;
GRANT ALL ON public.pm_pricing_tiers TO service_role;
