-- `public_profiles` is a view over `profiles` owned by `postgres` with security_invoker
-- off, so it executed with the owner's rights and bypassed row-level security entirely.
-- anon and authenticated held SELECT/INSERT/UPDATE/DELETE on it.
--
-- Because it is a simple single-table view it is auto-updatable, which made it an
-- unauthenticated write path into `profiles`: a PATCH against the view as anon was
-- accepted (verified against production — the request returned 204, i.e. the privilege
-- check passed), letting anyone rewrite another user's full_name / avatar_url. It also
-- served the full user directory to anon regardless of the policies on `profiles`.
--
-- No application code reads this view; it appears only as a foreign-key target in the
-- generated Supabase types.

-- Make the view honour the querying role's RLS instead of the owner's rights, so it can
-- never again be a way around the policies on the underlying table.
ALTER VIEW public.public_profiles SET (security_invoker = on);

REVOKE ALL ON public.public_profiles FROM anon, authenticated;

-- Read-only, and now filtered by the same profiles policies as a direct query.
GRANT SELECT ON public.public_profiles TO authenticated;
