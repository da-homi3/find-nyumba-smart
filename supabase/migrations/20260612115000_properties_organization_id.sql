-- Ensure organization_id exists before RLS hardening (idempotent for DBs created from older foundation).
ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_properties_organization ON public.properties(organization_id);
