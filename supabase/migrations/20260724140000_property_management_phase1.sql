-- Property Management Suite Phase 1 — parallel pm_* schema (marketplace `properties` untouched)

-- ── PROPERTIES ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_properties (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id     UUID NOT NULL REFERENCES public.profiles(id),
  agency_id         UUID REFERENCES public.organizations(id),
  name              TEXT NOT NULL,
  property_type     TEXT NOT NULL CHECK (property_type IN (
    'apartment_block', 'estate', 'single_unit', 'commercial', 'mixed_use'
  )),
  address           TEXT NOT NULL,
  neighborhood      TEXT NOT NULL,
  lat               DOUBLE PRECISION,
  lng               DOUBLE PRECISION,
  photo_url         TEXT,
  status            TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pm_properties_owner
  ON public.pm_properties (owner_user_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pm_properties_agency
  ON public.pm_properties (agency_id)
  WHERE deleted_at IS NULL;

-- ── BUILDINGS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_buildings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id   UUID NOT NULL REFERENCES public.pm_properties(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  floor_count   INTEGER,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_buildings_property ON public.pm_buildings (property_id);

-- ── UNITS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_units (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id       UUID NOT NULL REFERENCES public.pm_properties(id) ON DELETE CASCADE,
  building_id       UUID REFERENCES public.pm_buildings(id) ON DELETE SET NULL,
  unit_label        TEXT NOT NULL,
  floor             INTEGER,
  unit_type         TEXT CHECK (unit_type IN (
    'bedsitter', '1br', '2br', '3br', '4br+', 'commercial', 'other'
  )),
  bedrooms          INTEGER,
  bathrooms         INTEGER,
  monthly_rent      INTEGER NOT NULL CHECK (monthly_rent >= 0),
  deposit_amount    INTEGER NOT NULL DEFAULT 0,
  status            TEXT NOT NULL DEFAULT 'vacant' CHECK (status IN (
    'vacant', 'occupied', 'notice_given', 'vacant_soon', 'maintenance'
  )),
  amenities         JSONB NOT NULL DEFAULT '[]'::jsonb,
  caretaker_name    TEXT,
  caretaker_phone   TEXT,
  caretaker_pin     TEXT,
  linked_listing_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pm_units_property
  ON public.pm_units (property_id, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pm_units_building
  ON public.pm_units (building_id)
  WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_units_label_per_property
  ON public.pm_units (property_id, unit_label)
  WHERE deleted_at IS NULL;

-- ── TENANTS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_tenants (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id             UUID NOT NULL REFERENCES public.pm_properties(id) ON DELETE CASCADE,
  full_name               TEXT NOT NULL,
  phone                   TEXT NOT NULL,
  email                   TEXT,
  national_id             TEXT,
  emergency_contact_name  TEXT,
  emergency_contact_phone TEXT,
  occupation              TEXT,
  notes                   TEXT,
  tenant_user_id          UUID REFERENCES public.profiles(id),
  portal_invited_at       TIMESTAMPTZ,
  portal_status           TEXT NOT NULL DEFAULT 'not_invited' CHECK (portal_status IN (
    'not_invited', 'invited', 'accepted', 'declined'
  )),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at              TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pm_tenants_property
  ON public.pm_tenants (property_id)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_pm_tenants_user
  ON public.pm_tenants (tenant_user_id)
  WHERE tenant_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pm_tenants_phone ON public.pm_tenants (phone);

-- ── LEASES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_leases (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id            UUID NOT NULL REFERENCES public.pm_units(id) ON DELETE CASCADE,
  tenant_id          UUID NOT NULL REFERENCES public.pm_tenants(id) ON DELETE CASCADE,
  monthly_rent       INTEGER NOT NULL,
  deposit_paid       INTEGER NOT NULL DEFAULT 0,
  start_date         DATE NOT NULL,
  end_date           DATE NOT NULL,
  status             TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended', 'renewed')),
  lease_document_url TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_leases_unit ON public.pm_leases (unit_id, status);
CREATE INDEX IF NOT EXISTS idx_pm_leases_tenant ON public.pm_leases (tenant_id);
CREATE INDEX IF NOT EXISTS idx_pm_leases_end_date
  ON public.pm_leases (end_date)
  WHERE status = 'active';

-- ── RENT INVOICES & PAYMENTS ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_rent_invoices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lease_id      UUID NOT NULL REFERENCES public.pm_leases(id) ON DELETE CASCADE,
  period_month  TEXT NOT NULL,
  amount_due    INTEGER NOT NULL,
  amount_paid   INTEGER NOT NULL DEFAULT 0,
  due_date      DATE NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'partial', 'paid', 'overdue'
  )),
  late_fee      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_invoice_lease_period
  ON public.pm_rent_invoices (lease_id, period_month);
CREATE INDEX IF NOT EXISTS idx_pm_invoices_status
  ON public.pm_rent_invoices (status, due_date);

CREATE TABLE IF NOT EXISTS public.pm_rent_payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id          UUID NOT NULL REFERENCES public.pm_rent_invoices(id) ON DELETE CASCADE,
  amount              INTEGER NOT NULL CHECK (amount > 0),
  method              TEXT NOT NULL DEFAULT 'manual' CHECK (method IN (
    'manual', 'mpesa', 'bank', 'cash'
  )),
  recorded_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  note                TEXT,
  paid_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_payments_invoice ON public.pm_rent_payments (invoice_id);

-- ── MAINTENANCE REQUESTS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_maintenance_requests (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id              UUID NOT NULL REFERENCES public.pm_units(id) ON DELETE CASCADE,
  tenant_id            UUID REFERENCES public.pm_tenants(id) ON DELETE SET NULL,
  category             TEXT NOT NULL CHECK (category IN (
    'plumbing', 'electrical', 'security', 'internet', 'cleaning', 'water', 'structural', 'other'
  )),
  description          TEXT NOT NULL,
  priority             TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN (
    'low', 'normal', 'high', 'urgent'
  )),
  status               TEXT NOT NULL DEFAULT 'reported' CHECK (status IN (
    'reported', 'assigned', 'accepted', 'in_progress', 'completed', 'confirmed'
  )),
  assigned_provider_id UUID REFERENCES public.service_providers(id) ON DELETE SET NULL,
  photos               JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at         TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_pm_maintenance_unit
  ON public.pm_maintenance_requests (unit_id, status);
CREATE INDEX IF NOT EXISTS idx_pm_maintenance_status
  ON public.pm_maintenance_requests (status, priority);

-- ── STAFF ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_property_staff (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.pm_properties(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role        TEXT NOT NULL CHECK (role IN (
    'owner', 'property_manager', 'caretaker', 'security',
    'accountant', 'maintenance_supervisor', 'reception'
  )),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_pm_staff_property_user
  ON public.pm_property_staff (property_id, user_id);

-- ── NOTICES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pm_property_notices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id     UUID NOT NULL REFERENCES public.pm_properties(id) ON DELETE CASCADE,
  building_id     UUID REFERENCES public.pm_buildings(id) ON DELETE SET NULL,
  title           TEXT NOT NULL,
  body            TEXT NOT NULL,
  category        TEXT CHECK (category IN (
    'water', 'security', 'maintenance', 'garbage', 'rent', 'community', 'other'
  )),
  sent_by_user_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pm_notices_property
  ON public.pm_property_notices (property_id, created_at DESC);

-- ── ACCESS HELPER + RLS ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.pm_user_can_access_property(p_property_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    auth.uid() IS NOT NULL
    AND (
      public.has_role(auth.uid(), 'admin'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.pm_properties p
        WHERE p.id = p_property_id
          AND p.deleted_at IS NULL
          AND p.owner_user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM public.pm_property_staff s
        WHERE s.property_id = p_property_id
          AND s.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.pm_properties p
        JOIN public.organization_members om
          ON om.organization_id = p.agency_id
         AND om.user_id = auth.uid()
         AND om.role IN ('owner', 'member')
        WHERE p.id = p_property_id
          AND p.deleted_at IS NULL
          AND p.agency_id IS NOT NULL
      )
    );
$$;

ALTER TABLE public.pm_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_rent_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_rent_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_property_staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pm_property_notices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS pm_properties_select ON public.pm_properties;
CREATE POLICY pm_properties_select ON public.pm_properties
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.pm_user_can_access_property(id));

DROP POLICY IF EXISTS pm_properties_insert ON public.pm_properties;
CREATE POLICY pm_properties_insert ON public.pm_properties
  FOR INSERT TO authenticated
  WITH CHECK (
    owner_user_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS pm_properties_update ON public.pm_properties;
CREATE POLICY pm_properties_update ON public.pm_properties
  FOR UPDATE TO authenticated
  USING (public.pm_user_can_access_property(id))
  WITH CHECK (public.pm_user_can_access_property(id));

DROP POLICY IF EXISTS pm_buildings_all ON public.pm_buildings;
CREATE POLICY pm_buildings_all ON public.pm_buildings
  FOR ALL TO authenticated
  USING (public.pm_user_can_access_property(property_id))
  WITH CHECK (public.pm_user_can_access_property(property_id));

DROP POLICY IF EXISTS pm_units_all ON public.pm_units;
CREATE POLICY pm_units_all ON public.pm_units
  FOR ALL TO authenticated
  USING (public.pm_user_can_access_property(property_id))
  WITH CHECK (public.pm_user_can_access_property(property_id));

DROP POLICY IF EXISTS pm_tenants_all ON public.pm_tenants;
CREATE POLICY pm_tenants_all ON public.pm_tenants
  FOR ALL TO authenticated
  USING (
    public.pm_user_can_access_property(property_id)
    OR (tenant_user_id = auth.uid() AND deleted_at IS NULL)
  )
  WITH CHECK (public.pm_user_can_access_property(property_id));

DROP POLICY IF EXISTS pm_leases_all ON public.pm_leases;
CREATE POLICY pm_leases_all ON public.pm_leases
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pm_units u
      WHERE u.id = unit_id AND public.pm_user_can_access_property(u.property_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.pm_tenants t
      WHERE t.id = tenant_id AND t.tenant_user_id = auth.uid() AND t.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pm_units u
      WHERE u.id = unit_id AND public.pm_user_can_access_property(u.property_id)
    )
  );

DROP POLICY IF EXISTS pm_invoices_all ON public.pm_rent_invoices;
CREATE POLICY pm_invoices_all ON public.pm_rent_invoices
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pm_leases l
      JOIN public.pm_units u ON u.id = l.unit_id
      WHERE l.id = lease_id AND public.pm_user_can_access_property(u.property_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pm_leases l
      JOIN public.pm_units u ON u.id = l.unit_id
      WHERE l.id = lease_id AND public.pm_user_can_access_property(u.property_id)
    )
  );

DROP POLICY IF EXISTS pm_payments_all ON public.pm_rent_payments;
CREATE POLICY pm_payments_all ON public.pm_rent_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pm_rent_invoices i
      JOIN public.pm_leases l ON l.id = i.lease_id
      JOIN public.pm_units u ON u.id = l.unit_id
      WHERE i.id = invoice_id AND public.pm_user_can_access_property(u.property_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pm_rent_invoices i
      JOIN public.pm_leases l ON l.id = i.lease_id
      JOIN public.pm_units u ON u.id = l.unit_id
      WHERE i.id = invoice_id AND public.pm_user_can_access_property(u.property_id)
    )
  );

DROP POLICY IF EXISTS pm_maintenance_all ON public.pm_maintenance_requests;
CREATE POLICY pm_maintenance_all ON public.pm_maintenance_requests
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pm_units u
      WHERE u.id = unit_id AND public.pm_user_can_access_property(u.property_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pm_units u
      WHERE u.id = unit_id AND public.pm_user_can_access_property(u.property_id)
    )
  );

DROP POLICY IF EXISTS pm_staff_all ON public.pm_property_staff;
CREATE POLICY pm_staff_all ON public.pm_property_staff
  FOR ALL TO authenticated
  USING (public.pm_user_can_access_property(property_id) OR user_id = auth.uid())
  WITH CHECK (public.pm_user_can_access_property(property_id));

DROP POLICY IF EXISTS pm_notices_all ON public.pm_property_notices;
CREATE POLICY pm_notices_all ON public.pm_property_notices
  FOR ALL TO authenticated
  USING (public.pm_user_can_access_property(property_id))
  WITH CHECK (public.pm_user_can_access_property(property_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_properties TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_buildings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_tenants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_leases TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_rent_invoices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_rent_payments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_maintenance_requests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_property_staff TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pm_property_notices TO authenticated;

GRANT ALL ON public.pm_properties TO service_role;
GRANT ALL ON public.pm_buildings TO service_role;
GRANT ALL ON public.pm_units TO service_role;
GRANT ALL ON public.pm_tenants TO service_role;
GRANT ALL ON public.pm_leases TO service_role;
GRANT ALL ON public.pm_rent_invoices TO service_role;
GRANT ALL ON public.pm_rent_payments TO service_role;
GRANT ALL ON public.pm_maintenance_requests TO service_role;
GRANT ALL ON public.pm_property_staff TO service_role;
GRANT ALL ON public.pm_property_notices TO service_role;
