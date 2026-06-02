-- 1) Restrict profiles SELECT to authenticated users only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (true);

-- Public-safe view exposing only non-sensitive fields (no phone)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = on) AS
SELECT id, full_name, avatar_url
FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2) Explicitly deny INSERT/UPDATE/DELETE on user_roles via API
-- (grants already exclude these, but add restrictive policies for defense-in-depth)
CREATE POLICY "Block role inserts via API"
ON public.user_roles
FOR INSERT
TO authenticated, anon
WITH CHECK (false);

CREATE POLICY "Block role updates via API"
ON public.user_roles
FOR UPDATE
TO authenticated, anon
USING (false)
WITH CHECK (false);

CREATE POLICY "Block role deletes via API"
ON public.user_roles
FOR DELETE
TO authenticated, anon
USING (false);
