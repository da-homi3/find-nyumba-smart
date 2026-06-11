-- Portal roles, ops approval, caretaker PINs, agency portfolio

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS active_portal TEXT DEFAULT 'tenant'
    CHECK (active_portal IN ('tenant', 'landlord', 'manager', 'agency', 'caretaker')),
  ADD COLUMN IF NOT EXISTS is_portal_active BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_vacant BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_properties_organization ON public.properties(organization_id);

CREATE TABLE IF NOT EXISTS public.portal_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_role public.app_role NOT NULL
    CHECK (requested_role IN ('landlord', 'manager', 'agency')),
  organization_name TEXT,
  phone TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_applications_pending_unique
  ON public.portal_applications(user_id, requested_role)
  WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS public.caretakers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ,
  UNIQUE(landlord_id, phone)
);

CREATE TABLE IF NOT EXISTS public.caretaker_property_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caretaker_id UUID NOT NULL REFERENCES public.caretakers(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(caretaker_id, property_id)
);

CREATE TABLE IF NOT EXISTS public.caretaker_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  caretaker_id UUID NOT NULL REFERENCES public.caretakers(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caretaker_sessions_expires ON public.caretaker_sessions(expires_at);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role TEXT;
  org_name TEXT;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, active_portal)
  VALUES (
    NEW.id,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    'tenant'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    updated_at = NOW();

  meta_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'tenant'));
  org_name := NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'organization_name', '')), '');

  IF meta_role IN ('landlord', 'manager', 'agency') THEN
    INSERT INTO public.portal_applications (
      user_id, requested_role, organization_name, phone, notes, status
    )
    VALUES (
      NEW.id,
      meta_role::public.app_role,
      org_name,
      NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
      COALESCE(NEW.raw_user_meta_data->>'notes', NULL),
      'pending'
    )
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'tenant'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  IF meta_role = 'admin' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

ALTER TABLE public.portal_applications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users read own applications" ON public.portal_applications;
CREATE POLICY "Users read own applications" ON public.portal_applications
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users insert own applications" ON public.portal_applications;
CREATE POLICY "Users insert own applications" ON public.portal_applications
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admin manage applications" ON public.portal_applications;
CREATE POLICY "Admin manage applications" ON public.portal_applications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.caretakers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Landlords manage caretakers" ON public.caretakers;
CREATE POLICY "Landlords manage caretakers" ON public.caretakers
  FOR ALL USING (auth.uid() = landlord_id);

ALTER TABLE public.caretaker_property_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Landlords manage assignments" ON public.caretaker_property_assignments;
CREATE POLICY "Landlords manage assignments" ON public.caretaker_property_assignments
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.caretakers c
      WHERE c.id = caretaker_id AND c.landlord_id = auth.uid()
    )
  );
