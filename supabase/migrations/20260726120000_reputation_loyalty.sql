-- Phase 4: reputation (private factors) + loyalty points/levels

CREATE TABLE IF NOT EXISTS public.reputation_scores (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  score INTEGER NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
  factors_computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.reputation_factors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  factor_type TEXT NOT NULL CHECK (
    factor_type IN (
      'identity_verified',
      'ownership_verified',
      'on_time_payment',
      'late_payment',
      'quick_response',
      'tenant_satisfaction_rating',
      'job_completed',
      'job_incomplete'
    )
  ),
  weight REAL NOT NULL,
  related_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reputation_factors_idempotent
  ON public.reputation_factors (user_id, factor_type, related_id)
  WHERE related_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reputation_factors_user
  ON public.reputation_factors (user_id, created_at DESC);

ALTER TABLE public.reputation_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reputation_factors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own reputation score" ON public.reputation_scores;
CREATE POLICY "Users read own reputation score"
  ON public.reputation_scores FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Factors: no SELECT/INSERT/UPDATE for authenticated — service role only

CREATE TABLE IF NOT EXISTS public.loyalty_points (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  total_points INTEGER NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  current_level TEXT NOT NULL DEFAULT 'bronze' CHECK (
    current_level IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')
  ),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL CHECK (points > 0),
  reason TEXT NOT NULL,
  related_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_tx_idempotent
  ON public.loyalty_transactions (user_id, reason, related_id)
  WHERE related_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_loyalty_tx_user_reason_created
  ON public.loyalty_transactions (user_id, reason, created_at DESC);

ALTER TABLE public.loyalty_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own loyalty points" ON public.loyalty_points;
CREATE POLICY "Users read own loyalty points"
  ON public.loyalty_points FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users read own loyalty transactions" ON public.loyalty_transactions;
CREATE POLICY "Users read own loyalty transactions"
  ON public.loyalty_transactions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Writes: service role only (no INSERT/UPDATE policies for authenticated)
