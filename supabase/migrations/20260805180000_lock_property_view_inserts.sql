-- "Anyone can record property views" was INSERT TO public WITH CHECK (true), the only
-- write policy in the schema not gated on auth.uid(). It let an unauthenticated caller
-- insert unlimited rows into property_views, inflating the view counts that landlords are
-- shown and that feed the admin analytics.
--
-- Views are recorded exclusively through the record_property_view RPC on the service role
-- (see getProperty in nyumba-properties.ts); no client inserts into this table directly.

DROP POLICY IF EXISTS "Anyone can record property views" ON public.property_views;

REVOKE INSERT, UPDATE, DELETE ON public.property_views FROM anon, authenticated;
