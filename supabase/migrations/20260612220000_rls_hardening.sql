-- RLS hardening: verification_requests, profiles, property_attributes

DROP POLICY IF EXISTS "Users read own verification requests" ON public.verification_requests;
CREATE POLICY "Users read own verification requests" ON public.verification_requests
  FOR SELECT USING (
    lower(requester_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "Users insert own verification requests" ON public.verification_requests;
CREATE POLICY "Users insert own verification requests" ON public.verification_requests
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND lower(requester_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );

DROP POLICY IF EXISTS "Public read profiles basic" ON public.profiles;
DROP POLICY IF EXISTS "Read profiles for listings and conversations" ON public.profiles;
CREATE POLICY "Read profiles for listings and conversations" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.owner_id = profiles.id AND p.is_active = TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM public.inquiries i
      WHERE (
        (i.tenant_id = auth.uid() AND i.landlord_id = profiles.id)
        OR (i.landlord_id = auth.uid() AND i.tenant_id = profiles.id)
      )
    )
    OR EXISTS (
      SELECT 1
      FROM public.organization_members om
      WHERE om.user_id = auth.uid()
        AND om.organization_id IN (
          SELECT p.organization_id
          FROM public.properties p
          WHERE p.owner_id = profiles.id AND p.organization_id IS NOT NULL
        )
    )
  );

ALTER TABLE public.property_attributes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read property attributes" ON public.property_attributes;
CREATE POLICY "Public read property attributes" ON public.property_attributes
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_attributes.property_id AND p.is_active = TRUE
    )
  );

DROP POLICY IF EXISTS "Owners manage property attributes" ON public.property_attributes;
CREATE POLICY "Owners manage property attributes" ON public.property_attributes
  FOR ALL USING (
    EXISTS (
      SELECT 1
      FROM public.properties p
      WHERE p.id = property_attributes.property_id AND p.owner_id = auth.uid()
    )
  );
