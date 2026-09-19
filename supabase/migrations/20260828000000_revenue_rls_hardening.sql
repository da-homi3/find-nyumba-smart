-- Phase 0 revenue security: block self-grant Plus, free boosts, and subscription forgery.
-- Writes to revenue columns / subscription rows must go through service role (payment webhooks, admin, cron).

CREATE OR REPLACE FUNCTION public.guard_profiles_revenue_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := COALESCE(current_setting('request.jwt.claim.role', true), '');

  IF jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.tenant_plan := 'free';
    NEW.plus_expires_at := NULL;
    NEW.plus_contact_credits := 0;
    NEW.landlord_plan := COALESCE(NULLIF(NEW.landlord_plan, ''), 'free');
    NEW.lead_pack_balance := 0;
    NEW.bonus_listing_slots := 0;
    NEW.admin_listing_limit_override := NULL;
    NEW.founding_member_campaign_id := NULL;
    NEW.founding_member_claimed_at := NULL;
    NEW.founding_member_confirmed_at := NULL;
    NEW.founding_member_slot_number := NULL;
    NEW.founding_member_status := COALESCE(NULLIF(NEW.founding_member_status, ''), 'none');
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.tenant_plan := OLD.tenant_plan;
    NEW.plus_expires_at := OLD.plus_expires_at;
    NEW.plus_contact_credits := OLD.plus_contact_credits;
    NEW.trial_unlocks_remaining := OLD.trial_unlocks_remaining;
    NEW.trial_started_at := OLD.trial_started_at;
    NEW.trial_ends_at := OLD.trial_ends_at;
    NEW.landlord_plan := OLD.landlord_plan;
    NEW.lead_pack_balance := OLD.lead_pack_balance;
    NEW.bonus_listing_slots := OLD.bonus_listing_slots;
    NEW.admin_listing_limit_override := OLD.admin_listing_limit_override;
    NEW.founding_member_campaign_id := OLD.founding_member_campaign_id;
    NEW.founding_member_claimed_at := OLD.founding_member_claimed_at;
    NEW.founding_member_confirmed_at := OLD.founding_member_confirmed_at;
    NEW.founding_member_slot_number := OLD.founding_member_slot_number;
    NEW.founding_member_status := OLD.founding_member_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_guard_revenue_columns ON public.profiles;
CREATE TRIGGER profiles_guard_revenue_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_profiles_revenue_columns();

-- Subscriptions: authenticated users may read their own rows only; fulfillment uses service role.
DROP POLICY IF EXISTS "Users insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users update own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users delete own subscriptions" ON public.subscriptions;

-- Listing boosts: created only after verified payment (service role).
DROP POLICY IF EXISTS "Users insert own boosts" ON public.listing_boosts;
DROP POLICY IF EXISTS "Users update own boosts" ON public.listing_boosts;
DROP POLICY IF EXISTS "Users delete own boosts" ON public.listing_boosts;

COMMENT ON FUNCTION public.guard_profiles_revenue_columns() IS
  'Prevents authenticated clients from mutating revenue/plan columns on profiles; service_role bypasses.';
