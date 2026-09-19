-- Defense-in-depth: contact phones only via SECURITY DEFINER after unlock/owner/admin check.
-- App continues to use service-role TanStack server fns; this RPC blocks accidental PostgREST reads.

CREATE OR REPLACE FUNCTION public.get_property_contact(p_listing_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_owner_id uuid;
  v_has_access boolean;
  v_phone text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT owner_id, contact_phone
    INTO v_owner_id, v_phone
  FROM public.properties
  WHERE id = p_listing_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Listing not found';
  END IF;

  SELECT
    v_owner_id = v_user_id
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = v_user_id AND role = 'admin'
    )
    OR EXISTS (
      SELECT 1 FROM public.contact_unlocks
      WHERE user_id = v_user_id AND listing_id = p_listing_id
    )
  INTO v_has_access;

  IF NOT v_has_access THEN
    RAISE EXCEPTION 'Contact not unlocked for this listing';
  END IF;

  RETURN v_phone;
END;
$$;

REVOKE ALL ON FUNCTION public.get_property_contact(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_property_contact(uuid) TO authenticated;

-- Re-assert column grants (idempotent): readable + writable columns exclude contact PII.
DO $$
DECLARE
  readable_columns text;
  writable_columns text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY column_name)
    INTO readable_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'properties'
    AND column_name NOT IN ('contact_name', 'contact_phone', 'contact_phones');

  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY column_name)
    INTO writable_columns
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'properties'
    AND column_name NOT IN ('contact_name', 'contact_phone', 'contact_phones');

  IF readable_columns IS NULL OR writable_columns IS NULL THEN
    RAISE EXCEPTION 'properties columns not found — refusing to drop grants';
  END IF;

  EXECUTE 'REVOKE SELECT ON public.properties FROM anon, authenticated';
  EXECUTE format(
    'GRANT SELECT (%s) ON public.properties TO anon, authenticated',
    readable_columns
  );

  -- Table-level INSERT/UPDATE imply every column; re-issue without PII columns.
  EXECUTE 'REVOKE INSERT, UPDATE ON public.properties FROM authenticated';
  EXECUTE format(
    'GRANT INSERT (%s), UPDATE (%s) ON public.properties TO authenticated',
    writable_columns,
    writable_columns
  );
  -- DELETE stays table-level (no column variant needed).
  EXECUTE 'GRANT DELETE ON public.properties TO authenticated';
  EXECUTE 'REVOKE ALL (contact_name, contact_phone, contact_phones) ON public.properties FROM anon, authenticated';
  -- REFERENCES does not expose values; strip for a clean privilege surface.
  EXECUTE 'REVOKE REFERENCES (contact_name, contact_phone, contact_phones) ON public.properties FROM anon, authenticated';
END $$;
