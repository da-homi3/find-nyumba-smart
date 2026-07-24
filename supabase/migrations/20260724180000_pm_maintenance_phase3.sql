-- Phase 3: maintenance provider response tokens + tenant RLS

ALTER TABLE public.pm_maintenance_requests
  ADD COLUMN IF NOT EXISTS provider_response_token UUID,
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_pm_maintenance_provider_token
  ON public.pm_maintenance_requests (provider_response_token)
  WHERE provider_response_token IS NOT NULL;

-- Tenants with an accepted portal link can read/update their own requests
DROP POLICY IF EXISTS pm_maintenance_tenant_select ON public.pm_maintenance_requests;
CREATE POLICY pm_maintenance_tenant_select
  ON public.pm_maintenance_requests
  FOR SELECT
  USING (
    tenant_id IN (
      SELECT id FROM public.pm_tenants
      WHERE tenant_user_id = auth.uid()
        AND portal_status = 'accepted'
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS pm_maintenance_tenant_insert ON public.pm_maintenance_requests;
CREATE POLICY pm_maintenance_tenant_insert
  ON public.pm_maintenance_requests
  FOR INSERT
  WITH CHECK (
    tenant_id IN (
      SELECT id FROM public.pm_tenants
      WHERE tenant_user_id = auth.uid()
        AND portal_status = 'accepted'
        AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS pm_maintenance_tenant_update ON public.pm_maintenance_requests;
CREATE POLICY pm_maintenance_tenant_update
  ON public.pm_maintenance_requests
  FOR UPDATE
  USING (
    tenant_id IN (
      SELECT id FROM public.pm_tenants
      WHERE tenant_user_id = auth.uid()
        AND portal_status = 'accepted'
        AND deleted_at IS NULL
    )
  );
