-- Close two PII exposures that the anon (publishable) key could read directly off
-- PostgREST, bypassing the column allow-lists the application code uses.
--
-- Verified against production before writing this migration:
--   * profiles          — all 132 rows readable by anon, including `phone` and the
--                         entitlement columns (tenant_plan, lead_pack_balance, …).
--   * properties        — contact_phone / contact_name readable by anon for every
--                         active listing. That is exactly the data contact-unlock
--                         charges for, so the paywall was bypassable.
--
-- Application reads of the affected columns were moved to the service role first
-- (listLandlordProperties, listAgencyProperties, listManagerProperties,
-- getLandlordDashboard, getInquiryThread, insertPropertyListing), so nothing in the
-- app depends on the grants removed here.

-- ---------------------------------------------------------------------------
-- 1. Relationship helpers used by the profiles policies
-- ---------------------------------------------------------------------------
--
-- SECURITY DEFINER so the lookup is not itself filtered by the RLS on inquiries /
-- viewings / organization_members. Each answers only "does the caller have this
-- relationship with this user", so it leaks nothing about third parties.

CREATE OR REPLACE FUNCTION public.profile_is_contact_counterparty(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.inquiries i
    WHERE (i.tenant_id = auth.uid() AND i.landlord_id = _other)
       OR (i.landlord_id = auth.uid() AND i.tenant_id = _other)
  )
  OR EXISTS (
    SELECT 1 FROM public.viewings v
    WHERE (v.tenant_id = auth.uid() AND v.landlord_id = _other)
       OR (v.landlord_id = auth.uid() AND v.tenant_id = _other)
  );
$$;

-- Team lists must resolve every member of the caller's organization, including members
-- who own no listings — which the previous "owns a property in my org" test missed.
CREATE OR REPLACE FUNCTION public.profile_shares_organization(_other uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members me
    JOIN public.organization_members them
      ON them.organization_id = me.organization_id
    WHERE me.user_id = auth.uid()
      AND them.user_id = _other
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. profiles: replace the blanket read policies
-- ---------------------------------------------------------------------------

-- "Profiles are viewable by everyone" was SELECT ... USING (true) TO public: the whole
-- table, phone numbers included, readable with the publishable key.
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- This one was scoped, but one of its OR branches was "profiles.id owns an active
-- listing", which evaluates true for anon and therefore exposed every landlord's phone.
DROP POLICY IF EXISTS "Read profiles for listings and conversations" ON public.profiles;

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Read counterparty profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    public.profile_is_contact_counterparty(id)
    OR public.profile_shares_organization(id)
  );

-- Duplicate of the identical "Users can update their own profile" policy that is already
-- scoped TO authenticated; dropping it keeps the effective rules unambiguous.
DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;

-- No anon code path touches profiles.
REVOKE ALL ON public.profiles FROM anon;

-- ---------------------------------------------------------------------------
-- 3. properties: hide the listing contact columns from anon + authenticated
-- ---------------------------------------------------------------------------
--
-- These have to be column grants rather than RLS: the rows themselves must stay publicly
-- readable for browse, it is only three columns on those rows that are sensitive.
--
-- A column-level REVOKE is a no-op while a table-level SELECT grant exists, so the table
-- grant is dropped and re-issued per column. Built dynamically so the column list cannot
-- drift out of sync with the table.
--
-- NOTE: a future column added to `properties` will not be selectable by anon/authenticated
-- until it is granted. Re-run this block (or grant the new column) when adding one.
DO $$
DECLARE
  readable_columns text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY column_name)
    INTO readable_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'properties'
    AND column_name NOT IN ('contact_name', 'contact_phone', 'contact_phones');

  IF readable_columns IS NULL THEN
    RAISE EXCEPTION 'properties columns not found — refusing to drop the SELECT grant';
  END IF;

  EXECUTE 'REVOKE SELECT ON public.properties FROM anon, authenticated';
  EXECUTE format(
    'GRANT SELECT (%s) ON public.properties TO anon, authenticated',
    readable_columns
  );
END $$;

-- anon held INSERT/UPDATE/DELETE on both tables, held back only by policy. Unauthenticated
-- callers have no write path in the app, so remove the grants as well.
REVOKE INSERT, UPDATE, DELETE ON public.properties FROM anon;

-- ---------------------------------------------------------------------------
-- 4. Indexes backing the new policy predicates
-- ---------------------------------------------------------------------------
-- The counterparty check runs per candidate row, so both directions need support.

CREATE INDEX IF NOT EXISTS idx_inquiries_tenant_landlord
  ON public.inquiries (tenant_id, landlord_id);
CREATE INDEX IF NOT EXISTS idx_inquiries_landlord_tenant
  ON public.inquiries (landlord_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_viewings_tenant_landlord
  ON public.viewings (tenant_id, landlord_id);
CREATE INDEX IF NOT EXISTS idx_viewings_landlord_tenant
  ON public.viewings (landlord_id, tenant_id);

CREATE INDEX IF NOT EXISTS idx_org_members_user_org
  ON public.organization_members (user_id, organization_id);
CREATE INDEX IF NOT EXISTS idx_org_members_org_user
  ON public.organization_members (organization_id, user_id);
