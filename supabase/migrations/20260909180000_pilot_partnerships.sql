-- Property Partnership Pilot Program
-- Extends organizations + properties; does not replace listings or auth.

-- Expand organization types for pilot partners (idempotent).
DO $$
BEGIN
  ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_type_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.organizations
  ADD CONSTRAINT organizations_type_check
  CHECK (
    type IN (
      'agency',
      'property_manager',
      'developer',
      'landlord',
      'student_residence',
      'property_owner',
      'other'
    )
  );

ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS office_location text,
  ADD COLUMN IF NOT EXISTS social_links jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS public.pilot_partnerships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid REFERENCES public.organizations (id) ON DELETE SET NULL,
  partner_name text NOT NULL,
  partner_type text NOT NULL CHECK (
    partner_type IN (
      'REAL_ESTATE_AGENCY',
      'PROPERTY_DEVELOPER',
      'PROPERTY_MANAGER',
      'LANDLORD',
      'STUDENT_RESIDENCE',
      'PROPERTY_OWNER',
      'OTHER'
    )
  ),
  primary_contact_name text,
  primary_contact_email text,
  primary_contact_phone text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (
    status IN (
      'DRAFT',
      'INVITED',
      'APPLIED',
      'UNDER_REVIEW',
      'APPROVED',
      'ONBOARDING',
      'ACTIVE',
      'PAUSED',
      'EXTENDED',
      'COMPLETED',
      'CONVERTED',
      'DECLINED',
      'CANCELLED'
    )
  ),
  pilot_start_date date,
  pilot_end_date date,
  pilot_duration_days integer CHECK (pilot_duration_days IS NULL OR pilot_duration_days > 0),
  proposed_property_count integer CHECK (proposed_property_count IS NULL OR proposed_property_count >= 0),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  approved_at timestamptz,
  completed_at timestamptz,
  converted_at timestamptz,
  commercial_model text CHECK (
    commercial_model IS NULL
    OR commercial_model IN (
      'SUBSCRIPTION',
      'PREMIUM_LISTING',
      'LEAD_GENERATION',
      'REFERRAL',
      'PORTFOLIO_PARTNERSHIP',
      'CUSTOM'
    )
  ),
  partnership_start_date date,
  notes text,
  objectives jsonb NOT NULL DEFAULT '[]'::jsonb,
  success_criteria jsonb NOT NULL DEFAULT '[]'::jsonb,
  onboarding jsonb NOT NULL DEFAULT '{}'::jsonb,
  public_slug text UNIQUE,
  show_partner_badge boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilot_partnerships_status_idx
  ON public.pilot_partnerships (status, pilot_end_date);
CREATE INDEX IF NOT EXISTS pilot_partnerships_org_idx
  ON public.pilot_partnerships (organization_id);

CREATE TABLE IF NOT EXISTS public.pilot_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id uuid NOT NULL REFERENCES public.pilot_partnerships (id) ON DELETE CASCADE,
  email text NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')
  ),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilot_invitations_pilot_idx
  ON public.pilot_invitations (pilot_id, status);

CREATE TABLE IF NOT EXISTS public.pilot_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id uuid NOT NULL REFERENCES public.pilot_partnerships (id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PENDING' CHECK (
    status IN ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'LIVE', 'PAUSED', 'REMOVED')
  ),
  rejection_reason text,
  added_at timestamptz NOT NULL DEFAULT now(),
  approved_at timestamptz,
  removed_at timestamptz,
  notes text,
  UNIQUE (pilot_id, property_id)
);

CREATE INDEX IF NOT EXISTS pilot_properties_property_live_idx
  ON public.pilot_properties (property_id, status);
CREATE INDEX IF NOT EXISTS pilot_properties_pilot_status_idx
  ON public.pilot_properties (pilot_id, status);

CREATE TABLE IF NOT EXISTS public.pilot_kpis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id uuid NOT NULL REFERENCES public.pilot_partnerships (id) ON DELETE CASCADE,
  metric text NOT NULL,
  target numeric NOT NULL CHECK (target >= 0),
  actual numeric NOT NULL DEFAULT 0 CHECK (actual >= 0),
  unit text NOT NULL DEFAULT 'count',
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (pilot_id, metric)
);

CREATE TABLE IF NOT EXISTS public.pilot_analytics_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id uuid NOT NULL REFERENCES public.pilot_partnerships (id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  session_id text,
  event_type text NOT NULL CHECK (
    event_type IN (
      'PROPERTY_IMPRESSION',
      'PROPERTY_VIEW',
      'PROPERTY_SAVE',
      'CONTACT_CLICK',
      'CALL_CLICK',
      'WHATSAPP_CLICK',
      'ENQUIRY_SUBMITTED',
      'VIEWING_REQUESTED',
      'SHARE_CLICK',
      'DIRECTIONS_CLICK'
    )
  ),
  source text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilot_analytics_events_pilot_created_idx
  ON public.pilot_analytics_events (pilot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pilot_analytics_events_property_created_idx
  ON public.pilot_analytics_events (property_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pilot_analytics_events_type_created_idx
  ON public.pilot_analytics_events (event_type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.pilot_metrics_daily (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id uuid NOT NULL REFERENCES public.pilot_partnerships (id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties (id) ON DELETE CASCADE,
  day date NOT NULL,
  impressions integer NOT NULL DEFAULT 0,
  views integer NOT NULL DEFAULT 0,
  saves integer NOT NULL DEFAULT 0,
  contact_clicks integer NOT NULL DEFAULT 0,
  call_clicks integer NOT NULL DEFAULT 0,
  whatsapp_clicks integer NOT NULL DEFAULT 0,
  enquiries integer NOT NULL DEFAULT 0,
  viewing_requests integer NOT NULL DEFAULT 0,
  share_clicks integer NOT NULL DEFAULT 0,
  directions_clicks integer NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS pilot_metrics_daily_unique_idx
  ON public.pilot_metrics_daily (
    pilot_id,
    day,
    (COALESCE(property_id::text, ''))
  );

CREATE INDEX IF NOT EXISTS pilot_metrics_daily_pilot_day_idx
  ON public.pilot_metrics_daily (pilot_id, day DESC);

CREATE TABLE IF NOT EXISTS public.pilot_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id uuid NOT NULL REFERENCES public.pilot_partnerships (id) ON DELETE CASCADE,
  property_id uuid REFERENCES public.properties (id) ON DELETE SET NULL,
  lead_type text NOT NULL CHECK (
    lead_type IN ('enquiry', 'call', 'whatsapp', 'viewing', 'general')
  ),
  status text NOT NULL DEFAULT 'NEW' CHECK (
    status IN (
      'NEW',
      'CONTACTED',
      'QUALIFIED',
      'VIEWING_SCHEDULED',
      'VIEWED',
      'CONVERTED',
      'LOST',
      'UNRESPONSIVE'
    )
  ),
  contact_method text,
  inquiry_id uuid,
  viewing_id uuid,
  revenue_lead_id uuid,
  tenant_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  display_label text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilot_leads_pilot_created_idx
  ON public.pilot_leads (pilot_id, created_at DESC);
CREATE INDEX IF NOT EXISTS pilot_leads_status_idx
  ON public.pilot_leads (pilot_id, status);

CREATE TABLE IF NOT EXISTS public.pilot_activity_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id uuid NOT NULL REFERENCES public.pilot_partnerships (id) ON DELETE CASCADE,
  author_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  author_role text NOT NULL CHECK (author_role IN ('admin', 'partner')),
  body text NOT NULL CHECK (char_length(trim(body)) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pilot_activity_notes_pilot_idx
  ON public.pilot_activity_notes (pilot_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.partner_crm_prospects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_person text,
  position text,
  phone text,
  email text,
  website text,
  company_type text,
  location text,
  pipeline_status text NOT NULL DEFAULT 'PROSPECT' CHECK (
    pipeline_status IN (
      'PROSPECT',
      'CONTACTED',
      'INTERESTED',
      'PROPOSAL_SENT',
      'FOLLOW_UP',
      'DEMO',
      'PILOT_PROPOSED',
      'INVITED',
      'ACTIVE_PILOT',
      'REVIEW',
      'CONVERTED'
    )
  ),
  last_contacted_at timestamptz,
  next_follow_up_at timestamptz,
  assigned_staff_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  pilot_id uuid REFERENCES public.pilot_partnerships (id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_crm_prospects_pipeline_idx
  ON public.partner_crm_prospects (pipeline_status, next_follow_up_at);

CREATE TABLE IF NOT EXISTS public.partner_crm_followups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id uuid NOT NULL REFERENCES public.partner_crm_prospects (id) ON DELETE CASCADE,
  follow_up_at timestamptz NOT NULL,
  method text NOT NULL DEFAULT 'other' CHECK (
    method IN ('whatsapp', 'email', 'call', 'meeting', 'other')
  ),
  notes text,
  completed_at timestamptz,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_crm_followups_prospect_idx
  ON public.partner_crm_followups (prospect_id, follow_up_at);

-- RLS: partners read via org membership; writes go through service_role server functions.
ALTER TABLE public.pilot_partnerships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_kpis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pilot_activity_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_crm_prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_crm_followups ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pilot_partnerships FROM anon, authenticated;
REVOKE ALL ON public.pilot_invitations FROM anon, authenticated;
REVOKE ALL ON public.pilot_properties FROM anon, authenticated;
REVOKE ALL ON public.pilot_kpis FROM anon, authenticated;
REVOKE ALL ON public.pilot_analytics_events FROM anon, authenticated;
REVOKE ALL ON public.pilot_metrics_daily FROM anon, authenticated;
REVOKE ALL ON public.pilot_leads FROM anon, authenticated;
REVOKE ALL ON public.pilot_activity_notes FROM anon, authenticated;
REVOKE ALL ON public.partner_crm_prospects FROM anon, authenticated;
REVOKE ALL ON public.partner_crm_followups FROM anon, authenticated;

GRANT ALL ON public.pilot_partnerships TO service_role;
GRANT ALL ON public.pilot_invitations TO service_role;
GRANT ALL ON public.pilot_properties TO service_role;
GRANT ALL ON public.pilot_kpis TO service_role;
GRANT ALL ON public.pilot_analytics_events TO service_role;
GRANT ALL ON public.pilot_metrics_daily TO service_role;
GRANT ALL ON public.pilot_leads TO service_role;
GRANT ALL ON public.pilot_activity_notes TO service_role;
GRANT ALL ON public.partner_crm_prospects TO service_role;
GRANT ALL ON public.partner_crm_followups TO service_role;

-- Public can resolve LIVE partner badges / profiles through service functions only.
-- Admin/partner SELECT policies for authenticated users who are org members or admins.
DROP POLICY IF EXISTS "Admins manage pilot partnerships" ON public.pilot_partnerships;
CREATE POLICY "Admins manage pilot partnerships"
  ON public.pilot_partnerships
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Org members read own pilots" ON public.pilot_partnerships;
CREATE POLICY "Org members read own pilots"
  ON public.pilot_partnerships
  FOR SELECT
  TO authenticated
  USING (
    organization_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_members m
      WHERE m.organization_id = pilot_partnerships.organization_id
        AND m.user_id = auth.uid()
        AND m.role <> 'pending'
    )
  );

GRANT SELECT ON public.pilot_partnerships TO authenticated;

DROP POLICY IF EXISTS "Org members read own pilot properties" ON public.pilot_properties;
CREATE POLICY "Org members read own pilot properties"
  ON public.pilot_properties
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pilot_partnerships p
      JOIN public.organization_members m ON m.organization_id = p.organization_id
      WHERE p.id = pilot_properties.pilot_id
        AND m.user_id = auth.uid()
        AND m.role <> 'pending'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

GRANT SELECT ON public.pilot_properties TO authenticated;

DROP POLICY IF EXISTS "Org members read own pilot kpis" ON public.pilot_kpis;
CREATE POLICY "Org members read own pilot kpis"
  ON public.pilot_kpis
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pilot_partnerships p
      JOIN public.organization_members m ON m.organization_id = p.organization_id
      WHERE p.id = pilot_kpis.pilot_id
        AND m.user_id = auth.uid()
        AND m.role <> 'pending'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

GRANT SELECT ON public.pilot_kpis TO authenticated;

DROP POLICY IF EXISTS "Org members read own pilot metrics" ON public.pilot_metrics_daily;
CREATE POLICY "Org members read own pilot metrics"
  ON public.pilot_metrics_daily
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pilot_partnerships p
      JOIN public.organization_members m ON m.organization_id = p.organization_id
      WHERE p.id = pilot_metrics_daily.pilot_id
        AND m.user_id = auth.uid()
        AND m.role <> 'pending'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

GRANT SELECT ON public.pilot_metrics_daily TO authenticated;

DROP POLICY IF EXISTS "Org members read own pilot leads" ON public.pilot_leads;
CREATE POLICY "Org members read own pilot leads"
  ON public.pilot_leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pilot_partnerships p
      JOIN public.organization_members m ON m.organization_id = p.organization_id
      WHERE p.id = pilot_leads.pilot_id
        AND m.user_id = auth.uid()
        AND m.role <> 'pending'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

GRANT SELECT ON public.pilot_leads TO authenticated;

DROP POLICY IF EXISTS "Org members read own pilot notes" ON public.pilot_activity_notes;
CREATE POLICY "Org members read own pilot notes"
  ON public.pilot_activity_notes
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.pilot_partnerships p
      JOIN public.organization_members m ON m.organization_id = p.organization_id
      WHERE p.id = pilot_activity_notes.pilot_id
        AND m.user_id = auth.uid()
        AND m.role <> 'pending'
    )
    OR public.has_role(auth.uid(), 'admin')
  );

GRANT SELECT ON public.pilot_activity_notes TO authenticated;

DROP POLICY IF EXISTS "Admins manage CRM prospects" ON public.partner_crm_prospects;
CREATE POLICY "Admins manage CRM prospects"
  ON public.partner_crm_prospects
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_crm_prospects TO authenticated;

DROP POLICY IF EXISTS "Admins manage CRM followups" ON public.partner_crm_followups;
CREATE POLICY "Admins manage CRM followups"
  ON public.partner_crm_followups
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.partner_crm_followups TO authenticated;
