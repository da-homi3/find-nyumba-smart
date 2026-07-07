-- Founding Member promo: limited slots per role, bonus listings after first paid month

CREATE TABLE IF NOT EXISTS public.promo_campaigns (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL UNIQUE CHECK (role IN ('agency', 'manager', 'landlord')),
  max_slots INTEGER NOT NULL,
  slots_claimed INTEGER NOT NULL DEFAULT 0,
  slots_confirmed INTEGER NOT NULL DEFAULT 0,
  bonus_listings INTEGER NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.promo_campaigns (id, role, max_slots, bonus_listings)
VALUES
  ('promo-agency', 'agency', 25, 10),
  ('promo-pm', 'manager', 25, 10),
  ('promo-landlord', 'landlord', 15, 5)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS founding_member_status TEXT NOT NULL DEFAULT 'none'
    CHECK (founding_member_status IN ('none', 'pending', 'confirmed', 'forfeited')),
  ADD COLUMN IF NOT EXISTS founding_member_slot_number INTEGER,
  ADD COLUMN IF NOT EXISTS founding_member_campaign_id TEXT REFERENCES public.promo_campaigns (id),
  ADD COLUMN IF NOT EXISTS bonus_listing_slots INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS founding_member_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS founding_member_confirmed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_profiles_founding_status
  ON public.profiles (founding_member_status)
  WHERE founding_member_status <> 'none';

-- Atomic slot claim (race-safe under concurrent signups)
CREATE OR REPLACE FUNCTION public.claim_founding_member_slot(
  p_user_id UUID,
  p_campaign_id TEXT
)
RETURNS TABLE (claimed BOOLEAN, slot_number INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slot INTEGER;
BEGIN
  UPDATE public.promo_campaigns
  SET slots_claimed = slots_claimed + 1
  WHERE id = p_campaign_id
    AND active = TRUE
    AND slots_claimed < max_slots
  RETURNING slots_claimed INTO v_slot;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, NULL::INTEGER;
    RETURN;
  END IF;

  UPDATE public.profiles
  SET
    founding_member_status = 'pending',
    founding_member_slot_number = v_slot,
    founding_member_campaign_id = p_campaign_id,
    founding_member_claimed_at = now()
  WHERE id = p_user_id;

  RETURN QUERY SELECT TRUE, v_slot;
END;
$$;

-- Release slot when trial fails to convert (pending only)
CREATE OR REPLACE FUNCTION public.release_founding_member_slot(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id TEXT;
  v_status TEXT;
BEGIN
  SELECT founding_member_campaign_id, founding_member_status
  INTO v_campaign_id, v_status
  FROM public.profiles
  WHERE id = p_user_id;

  IF v_campaign_id IS NULL OR v_status <> 'pending' THEN
    RETURN FALSE;
  END IF;

  UPDATE public.promo_campaigns
  SET slots_claimed = GREATEST(0, slots_claimed - 1)
  WHERE id = v_campaign_id;

  UPDATE public.profiles
  SET founding_member_status = 'forfeited'
  WHERE id = p_user_id;

  RETURN TRUE;
END;
$$;

-- Confirm bonus after first successful payment
CREATE OR REPLACE FUNCTION public.confirm_founding_member_bonus(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign_id TEXT;
  v_bonus INTEGER;
BEGIN
  SELECT p.founding_member_campaign_id, c.bonus_listings
  INTO v_campaign_id, v_bonus
  FROM public.profiles p
  JOIN public.promo_campaigns c ON c.id = p.founding_member_campaign_id
  WHERE p.id = p_user_id
    AND p.founding_member_status = 'pending';

  IF v_campaign_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.profiles
  SET
    founding_member_status = 'confirmed',
    founding_member_confirmed_at = now(),
    bonus_listing_slots = bonus_listing_slots + v_bonus
  WHERE id = p_user_id;

  UPDATE public.promo_campaigns
  SET slots_confirmed = slots_confirmed + 1
  WHERE id = v_campaign_id;

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_founding_member_slot(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_founding_member_slot(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.confirm_founding_member_bonus(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.claim_founding_member_slot(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_founding_member_slot(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.confirm_founding_member_bonus(UUID) TO service_role;

ALTER TABLE public.promo_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY promo_campaigns_public_read ON public.promo_campaigns
  FOR SELECT USING (active = TRUE);
