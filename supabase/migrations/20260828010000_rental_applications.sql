-- Rental applications: tenant apply → landlord review workflow.

CREATE TABLE IF NOT EXISTS public.rental_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'submitted'
    CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected', 'withdrawn')),
  message TEXT,
  move_in_date DATE,
  tenant_score_percent INTEGER
    CHECK (tenant_score_percent IS NULL OR (tenant_score_percent >= 0 AND tenant_score_percent <= 100)),
  share_profile BOOLEAN NOT NULL DEFAULT false,
  landlord_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_rental_applications_active
  ON public.rental_applications (property_id, tenant_id)
  WHERE status NOT IN ('withdrawn', 'rejected');

CREATE INDEX IF NOT EXISTS idx_rental_applications_landlord
  ON public.rental_applications (landlord_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_rental_applications_tenant
  ON public.rental_applications (tenant_id, created_at DESC);

ALTER TABLE public.rental_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants read own applications" ON public.rental_applications;
CREATE POLICY "Tenants read own applications" ON public.rental_applications
  FOR SELECT USING (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Landlords read property applications" ON public.rental_applications;
CREATE POLICY "Landlords read property applications" ON public.rental_applications
  FOR SELECT USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Tenants submit applications" ON public.rental_applications;
CREATE POLICY "Tenants submit applications" ON public.rental_applications
  FOR INSERT WITH CHECK (
    auth.uid() = tenant_id
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = property_id AND p.is_active = TRUE AND p.owner_id = landlord_id
    )
  );

DROP POLICY IF EXISTS "Tenants withdraw applications" ON public.rental_applications;
CREATE POLICY "Tenants withdraw applications" ON public.rental_applications
  FOR UPDATE USING (auth.uid() = tenant_id)
  WITH CHECK (auth.uid() = tenant_id AND status = 'withdrawn');

DROP POLICY IF EXISTS "Landlords review applications" ON public.rental_applications;
CREATE POLICY "Landlords review applications" ON public.rental_applications
  FOR UPDATE USING (auth.uid() = landlord_id)
  WITH CHECK (auth.uid() = landlord_id);

COMMENT ON TABLE public.rental_applications IS
  'Tenant rental applications for specific listings; one active application per tenant per property.';
