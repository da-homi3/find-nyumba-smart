-- Tenant complaints (seen + landlord reply) + mpesa_sms payment method

CREATE TABLE IF NOT EXISTS public.pm_complaints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES public.pm_properties(id) ON DELETE CASCADE,
  unit_id         UUID NOT NULL REFERENCES public.pm_units(id) ON DELETE CASCADE,
  tenant_id       UUID NOT NULL REFERENCES public.pm_tenants(id) ON DELETE CASCADE,
  lease_id        UUID REFERENCES public.pm_leases(id) ON DELETE SET NULL,
  subject         TEXT NOT NULL,
  body            TEXT NOT NULL,
  photo_url       TEXT,
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'seen', 'replied', 'closed'
  )),
  seen_at         TIMESTAMPTZ,
  seen_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  landlord_reply  TEXT,
  replied_at      TIMESTAMPTZ,
  replied_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pm_complaints_property_status
  ON public.pm_complaints (property_id, status)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_pm_complaints_tenant_created
  ON public.pm_complaints (tenant_id, created_at DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE public.pm_complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_complaints_staff_all ON public.pm_complaints;
CREATE POLICY pm_complaints_staff_all ON public.pm_complaints
  FOR ALL TO authenticated
  USING (public.pm_user_can_access_property(property_id))
  WITH CHECK (public.pm_user_can_access_property(property_id));

DROP POLICY IF EXISTS pm_complaints_tenant_select ON public.pm_complaints;
CREATE POLICY pm_complaints_tenant_select ON public.pm_complaints
  FOR SELECT TO authenticated
  USING (
    tenant_id IN (
      SELECT id FROM public.pm_tenants
      WHERE tenant_user_id = auth.uid()
        AND portal_status = 'accepted'
        AND deleted_at IS NULL
    )
    AND deleted_at IS NULL
  );

DROP POLICY IF EXISTS pm_complaints_tenant_insert ON public.pm_complaints;
CREATE POLICY pm_complaints_tenant_insert ON public.pm_complaints
  FOR INSERT TO authenticated
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM public.pm_tenants
      WHERE tenant_user_id = auth.uid()
        AND portal_status = 'accepted'
        AND deleted_at IS NULL
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_complaints TO authenticated;
GRANT ALL ON public.pm_complaints TO service_role;

-- Allow SMS-pasted M-Pesa confirmations on the rent ledger
ALTER TABLE public.pm_rent_payments
  DROP CONSTRAINT IF EXISTS pm_rent_payments_method_check;

ALTER TABLE public.pm_rent_payments
  ADD CONSTRAINT pm_rent_payments_method_check
  CHECK (method IN ('manual', 'mpesa', 'bank', 'cash', 'mpesa_sms'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_rent_payments_mpesa_receipt_unique
  ON public.pm_rent_payments (mpesa_receipt_number)
  WHERE mpesa_receipt_number IS NOT NULL AND mpesa_receipt_number <> '';

-- Allow complaint notification types
ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check CHECK (
    type = ANY (ARRAY[
      'announcement'::text,
      'listing_match'::text,
      'message'::text,
      'lead'::text,
      'portal'::text,
      'account'::text,
      'maintenance_new'::text,
      'maintenance_update'::text,
      'maintenance_confirm'::text,
      'complaint_new'::text,
      'complaint_reply'::text,
      'rent'::text,
      'payment'::text,
      'system'::text
    ])
  );
