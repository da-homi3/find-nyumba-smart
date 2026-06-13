-- Explicit viewings RLS so tenants can INSERT bookings (FOR ALL + USING-only policies
-- can block inserts in some Postgres/Supabase versions).

DROP POLICY IF EXISTS "Viewings for participants" ON public.viewings;

CREATE POLICY "Participants read viewings" ON public.viewings
  FOR SELECT USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);

CREATE POLICY "Tenants book viewings" ON public.viewings
  FOR INSERT WITH CHECK (auth.uid() = tenant_id);

CREATE POLICY "Participants update viewings" ON public.viewings
  FOR UPDATE USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);
