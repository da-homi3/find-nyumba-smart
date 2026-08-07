-- Security + integrity hardening.
--
-- 1. Schema support for reversible payouts (new batch statuses, fee reversal marker)
-- 2. Close privilege-escalation holes where the authenticated role could grant itself
--    paid entitlements or trust badges by writing columns directly through PostgREST
-- 3. Uniqueness on payment provider references so a replayed callback cannot double-credit
-- 4. Non-negative money constraints and missing hot-path indexes
--
-- NOTE: `requireSupabaseAuth` server functions run with the *user's* JWT, so they share
-- the `authenticated` role's column grants with the browser. Grants kept below reflect
-- the columns those paths actually write (profile basics, listing content, verification
-- submissions); everything else is written by the service role and is revoked here.

-- ---------------------------------------------------------------------------
-- 1. Payout schema support
-- ---------------------------------------------------------------------------

-- 'needs_review' marks a payout whose provider outcome is unknown: it must never be
-- auto-retried, because the transfer may already have been accepted.
ALTER TABLE public.pm_payout_batches
  DROP CONSTRAINT IF EXISTS pm_payout_batches_status_check;
ALTER TABLE public.pm_payout_batches
  ADD CONSTRAINT pm_payout_batches_status_check CHECK (status IN (
    'pending', 'processing', 'completed', 'failed', 'needs_review', 'cancelled'
  ));

-- Reversing a rent payment cancels its unpaid fee row so no payout picks it up.
ALTER TABLE public.pm_platform_fee_ledger
  ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;

DROP INDEX IF EXISTS public.idx_pm_fee_ledger_unbatched;
CREATE INDEX IF NOT EXISTS idx_pm_fee_ledger_unbatched
  ON public.pm_platform_fee_ledger (owner_user_id, created_at)
  WHERE payout_batch_id IS NULL AND reversed_at IS NULL;

-- ---------------------------------------------------------------------------
-- 2. Privilege escalation lockdown
-- ---------------------------------------------------------------------------

-- 2a. profiles: entitlement columns (plans, trial unlocks, lead packs, referral credit)
-- were writable by their owner, which let a user grant themselves paid features.
--
-- Only the *write* side is closed here. The broad "Authenticated users can view profiles"
-- read policy is a separate (real) leak — it exposes every user's phone number, which is
-- the thing contact-unlock charges for — but it cannot be dropped until these server
-- functions stop reading counterparty profiles on the caller's JWT:
--   nyumba-inquiries.ts (counterparty reveal), booking.functions.ts (participants),
--   nyumba-team.ts and nyumba-properties.ts (team member lists).
-- They must move to the service-role client with their own authorization checks first.
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, avatar_url, active_portal) ON public.profiles TO authenticated;

REVOKE INSERT ON public.profiles FROM authenticated;
GRANT INSERT (id, full_name, phone, avatar_url, active_portal) ON public.profiles TO authenticated;

-- 2b. properties: owners may edit listing content but not award themselves the verified
-- badge or paid placement.
--
-- A trigger is used rather than column REVOKEs because a column-level revoke does not
-- override an existing table-level grant, and because owners must keep full UPDATE access
-- to the listing content columns. Only anon/authenticated writes are clamped, so the
-- service role and the existing scoring triggers are unaffected; clamping (rather than
-- raising) means ordinary listing edits keep working.
--
-- `authenticity_score` and `health_score` are deliberately NOT guarded here: they are
-- already owned by the `update_authenticity_score` / `update_health_score` triggers, and
-- clamping them would revert the recalculation those triggers perform.
-- Deliberately SECURITY INVOKER (the default): under SECURITY DEFINER `current_user` is
-- the function owner, so the role test below would never match and the guard would be a
-- no-op. The function touches no tables, so it needs no elevated rights.
CREATE OR REPLACE FUNCTION public.guard_property_trust_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user NOT IN ('anon', 'authenticated') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_verified := FALSE;
    NEW.nyumba_verified_at := NULL;
    NEW.featured_until := NULL;
    NEW.boost_package := NULL;
  ELSE
    NEW.is_verified := OLD.is_verified;
    NEW.nyumba_verified_at := OLD.nyumba_verified_at;
    NEW.featured_until := OLD.featured_until;
    NEW.boost_package := OLD.boost_package;
  END IF;

  RETURN NEW;
END;
$$;

-- Runs before `update_authenticity_score` (alphabetical order), which then recomputes
-- the score as it does today.
DROP TRIGGER IF EXISTS guard_property_trust_columns ON public.properties;
CREATE TRIGGER guard_property_trust_columns
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.guard_property_trust_columns();

-- 2c. verifications: users may submit, only staff may approve.
DROP POLICY IF EXISTS "Users manage own verifications" ON public.verifications;

DROP POLICY IF EXISTS "Users read own verifications" ON public.verifications;
CREATE POLICY "Users read own verifications" ON public.verifications
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- The admin review queue (`listVerifications`) runs on the reviewing admin's JWT, so it
-- needs a policy of its own once the blanket "manage own" policy is gone.
DROP POLICY IF EXISTS "Admins read all verifications" ON public.verifications;
CREATE POLICY "Admins read all verifications" ON public.verifications
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users submit own verifications" ON public.verifications;
CREATE POLICY "Users submit own verifications" ON public.verifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND status = 'pending');

REVOKE UPDATE, DELETE ON public.verifications FROM authenticated;

-- 2d. subscriptions / listing_boosts / invoices: entitlement records. Read-only for
-- their owner; every write goes through payment fulfillment on the service role.
DROP POLICY IF EXISTS "Users insert own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users update own subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Users delete own subscriptions" ON public.subscriptions;
REVOKE INSERT, UPDATE, DELETE ON public.subscriptions FROM authenticated;

DROP POLICY IF EXISTS "Users insert own boosts" ON public.listing_boosts;
DROP POLICY IF EXISTS "Users update own boosts" ON public.listing_boosts;
DROP POLICY IF EXISTS "Users delete own boosts" ON public.listing_boosts;
DROP POLICY IF EXISTS "Owners manage own listing boosts" ON public.listing_boosts;
REVOKE INSERT, UPDATE, DELETE ON public.listing_boosts FROM authenticated;

DROP POLICY IF EXISTS "Users insert own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users update own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users delete own invoices" ON public.invoices;
REVOKE INSERT, UPDATE, DELETE ON public.invoices FROM authenticated;

-- 2e. Tables created without RLS. These hold raw webhook bodies, viewer analytics and
-- the admin audit trail — none should be reachable with an anon/authenticated key.
ALTER TABLE public.payment_webhook_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.payment_webhook_log FROM anon, authenticated;

ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.property_views FROM anon, authenticated;

-- Audit rows are written by the service role only, but the admin log viewer reads them on
-- the admin's own JWT — so SELECT is granted back and then narrowed to admins by policy.
-- (A REVOKE cannot be undone by a policy: the grant has to exist for RLS to be consulted.)
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_audit_logs FROM anon, authenticated;
GRANT SELECT ON public.admin_audit_logs TO authenticated;

DROP POLICY IF EXISTS "Admins read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins read audit logs" ON public.admin_audit_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- 3. Payment reference uniqueness (replay / double-credit protection)
-- ---------------------------------------------------------------------------

-- Created defensively: if historical duplicates exist the index cannot be built, and a
-- hard failure here would block every later migration. Warn instead, and clean up first.
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_mpesa_receipt_unique
      ON public.payments (mpesa_receipt)
      WHERE mpesa_receipt IS NOT NULL AND mpesa_receipt <> '';
  EXCEPTION WHEN unique_violation THEN
    RAISE WARNING 'Duplicate payments.mpesa_receipt values exist — dedupe then create idx_payments_mpesa_receipt_unique';
  END;

  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_checkout_unique
      ON public.payments (mpesa_checkout_id)
      WHERE mpesa_checkout_id IS NOT NULL;
  EXCEPTION WHEN unique_violation THEN
    RAISE WARNING 'Duplicate payments.mpesa_checkout_id values exist — dedupe then create idx_payments_checkout_unique';
  END;

  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_idempotency_key_unique
      ON public.payments (idempotency_key)
      WHERE idempotency_key IS NOT NULL;
  EXCEPTION WHEN unique_violation THEN
    RAISE WARNING 'Duplicate payments.idempotency_key values exist — dedupe then create idx_payments_idempotency_key_unique';
  END;
END $$;

-- The non-unique checkout index is redundant once the unique one exists.
DROP INDEX IF EXISTS public.idx_payments_checkout;

-- ---------------------------------------------------------------------------
-- 4. Money constraints + hot-path indexes
-- ---------------------------------------------------------------------------

-- NOT VALID keeps the migration fast and tolerant of legacy rows while still enforcing
-- the constraint on every new write. Validate separately once historical data is clean.
DO $$
BEGIN
  ALTER TABLE public.pm_leases
    ADD CONSTRAINT pm_leases_monthly_rent_nonneg CHECK (monthly_rent >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.pm_leases
    ADD CONSTRAINT pm_leases_deposit_paid_nonneg CHECK (deposit_paid >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.pm_rent_invoices
    ADD CONSTRAINT pm_invoices_amount_due_nonneg CHECK (amount_due >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE public.pm_rent_invoices
    ADD CONSTRAINT pm_invoices_late_fee_nonneg CHECK (late_fee >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Phone lookup runs on every phone-OTP signup (`auth.functions.ts` matches phone variants).
CREATE INDEX IF NOT EXISTS idx_profiles_phone
  ON public.profiles (phone)
  WHERE phone IS NOT NULL;

-- Admin portal-approval inbox: filtered by status, ordered by age.
CREATE INDEX IF NOT EXISTS idx_portal_applications_pending_created
  ON public.portal_applications (created_at ASC)
  WHERE status = 'pending';

-- Every tenant rent/maintenance call resolves the tenant by user + accepted portal status.
CREATE INDEX IF NOT EXISTS idx_pm_tenants_user_portal
  ON public.pm_tenants (tenant_user_id, portal_status)
  WHERE deleted_at IS NULL AND tenant_user_id IS NOT NULL;
