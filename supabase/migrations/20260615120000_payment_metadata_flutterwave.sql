-- Payment metadata for async webhook fulfillment + Flutterwave/M-Pesa tracking

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS payment_method TEXT CHECK (payment_method IN ('mpesa', 'card'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency
  ON public.payments(idempotency_key)
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS lead_pack_balance INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.report_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_purchases_user ON public.report_purchases(user_id);

CREATE TABLE IF NOT EXISTS public.payment_webhook_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('mpesa', 'flutterwave')),
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  raw_payload JSONB NOT NULL,
  signature_valid BOOLEAN NOT NULL DEFAULT false,
  processed BOOLEAN NOT NULL DEFAULT false,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.verification_requests
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS paid BOOLEAN NOT NULL DEFAULT false;
