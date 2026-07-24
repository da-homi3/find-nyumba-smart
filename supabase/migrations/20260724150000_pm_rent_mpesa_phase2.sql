-- Property Management Phase 2 — M-Pesa rent collection

ALTER TABLE public.pm_rent_payments
  ADD COLUMN IF NOT EXISTS mpesa_receipt_number TEXT,
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;

ALTER TABLE public.pm_leases
  ADD COLUMN IF NOT EXISTS tenant_mpesa_phone TEXT;

ALTER TABLE public.pm_properties
  ADD COLUMN IF NOT EXISTS late_fee_percent_per_week NUMERIC(5,2) NOT NULL DEFAULT 5
    CHECK (late_fee_percent_per_week >= 0 AND late_fee_percent_per_week <= 100);

CREATE TABLE IF NOT EXISTS public.pm_rent_reminder_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES public.pm_rent_invoices(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN (
    'upcoming', 'due_today', 'overdue_3day', 'overdue_7day'
  )),
  sent_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_reminder_dedup
  ON public.pm_rent_reminder_log (invoice_id, reminder_type);

CREATE INDEX IF NOT EXISTS idx_pm_rent_payments_payment_id
  ON public.pm_rent_payments (payment_id)
  WHERE payment_id IS NOT NULL;

ALTER TABLE public.pm_rent_reminder_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_reminder_log_select ON public.pm_rent_reminder_log;
CREATE POLICY pm_reminder_log_select ON public.pm_rent_reminder_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pm_rent_invoices i
      JOIN public.pm_leases l ON l.id = i.lease_id
      JOIN public.pm_units u ON u.id = l.unit_id
      WHERE i.id = invoice_id AND public.pm_user_can_access_property(u.property_id)
    )
  );

GRANT SELECT ON public.pm_rent_reminder_log TO authenticated;
GRANT ALL ON public.pm_rent_reminder_log TO service_role;
