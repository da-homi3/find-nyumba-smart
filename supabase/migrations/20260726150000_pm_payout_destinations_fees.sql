-- Rent payout destinations, 1% platform fee ledger, batched payout batches

CREATE TABLE IF NOT EXISTS public.pm_payout_destinations (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id             UUID REFERENCES public.pm_properties(id) ON DELETE CASCADE,
  destination_type        TEXT NOT NULL CHECK (destination_type IN (
    'mpesa_paybill', 'mpesa_till', 'mpesa_phone', 'bank_account'
  )),
  mpesa_paybill_number    TEXT,
  mpesa_account_number    TEXT,
  mpesa_till_number       TEXT,
  mpesa_phone             TEXT,
  bank_name               TEXT,
  bank_code               TEXT,
  bank_account_number     TEXT,
  bank_account_name       TEXT,
  verified                BOOLEAN NOT NULL DEFAULT false,
  is_active               BOOLEAN NOT NULL DEFAULT true,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pm_payout_dest_owner
  ON public.pm_payout_destinations (owner_user_id, is_active)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pm_payout_dest_property
  ON public.pm_payout_destinations (property_id)
  WHERE deleted_at IS NULL AND property_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.pm_platform_fee_ledger (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rent_payment_id     UUID NOT NULL REFERENCES public.pm_rent_payments(id) ON DELETE CASCADE,
  owner_user_id       UUID NOT NULL REFERENCES public.profiles(id),
  property_id         UUID NOT NULL REFERENCES public.pm_properties(id),
  gross_amount        INTEGER NOT NULL CHECK (gross_amount > 0),
  platform_fee        INTEGER NOT NULL CHECK (platform_fee >= 0),
  net_payout_amount   INTEGER NOT NULL CHECK (net_payout_amount >= 0),
  payout_batch_id     UUID,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (rent_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_pm_fee_ledger_unbatched
  ON public.pm_platform_fee_ledger (owner_user_id, created_at)
  WHERE payout_batch_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_pm_fee_ledger_payment
  ON public.pm_platform_fee_ledger (rent_payment_id);

CREATE TABLE IF NOT EXISTS public.pm_payout_batches (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id           UUID NOT NULL REFERENCES public.profiles(id),
  payout_destination_id   UUID NOT NULL REFERENCES public.pm_payout_destinations(id),
  total_gross             INTEGER NOT NULL,
  total_platform_fee      INTEGER NOT NULL,
  total_net_payout        INTEGER NOT NULL,
  rent_payment_ids        UUID[] NOT NULL DEFAULT '{}',
  status                  TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'completed', 'failed'
  )),
  provider_ref            TEXT,
  failure_reason          TEXT,
  attempts                INTEGER NOT NULL DEFAULT 0,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at            TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pm_payout_batches_owner
  ON public.pm_payout_batches (owner_user_id, status);
CREATE INDEX IF NOT EXISTS idx_pm_payout_batches_status
  ON public.pm_payout_batches (status, created_at);

ALTER TABLE public.pm_platform_fee_ledger
  DROP CONSTRAINT IF EXISTS pm_platform_fee_ledger_payout_batch_id_fkey;
ALTER TABLE public.pm_platform_fee_ledger
  ADD CONSTRAINT pm_platform_fee_ledger_payout_batch_id_fkey
  FOREIGN KEY (payout_batch_id) REFERENCES public.pm_payout_batches(id) ON DELETE SET NULL;

ALTER TABLE public.pm_payout_destinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_platform_fee_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_payout_batches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_payout_dest_owner_select ON public.pm_payout_destinations;
CREATE POLICY pm_payout_dest_owner_select ON public.pm_payout_destinations
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS pm_fee_ledger_owner_select ON public.pm_platform_fee_ledger;
CREATE POLICY pm_fee_ledger_owner_select ON public.pm_platform_fee_ledger
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS pm_payout_batches_owner_select ON public.pm_payout_batches;
CREATE POLICY pm_payout_batches_owner_select ON public.pm_payout_batches
  FOR SELECT TO authenticated
  USING (owner_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

GRANT SELECT ON public.pm_payout_destinations TO authenticated;
GRANT SELECT ON public.pm_platform_fee_ledger TO authenticated;
GRANT SELECT ON public.pm_payout_batches TO authenticated;
GRANT ALL ON public.pm_payout_destinations TO service_role;
GRANT ALL ON public.pm_platform_fee_ledger TO service_role;
GRANT ALL ON public.pm_payout_batches TO service_role;
