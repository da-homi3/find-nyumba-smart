-- Re-assert properties contact PII column grants.
-- contact_phones was added after earlier grants; this keeps anon/authenticated
-- from selecting contact_name / contact_phone / contact_phones via PostgREST.
-- Idempotent — safe to re-run.

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
