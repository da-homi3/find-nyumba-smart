-- Property developer + agent AppRoles, org type, and pilot partner type.

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'property_developer';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'agent';

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
      'agent',
      'landlord',
      'student_residence',
      'property_owner',
      'other'
    )
  );

DO $$
BEGIN
  ALTER TABLE public.pilot_partnerships DROP CONSTRAINT IF EXISTS pilot_partnerships_partner_type_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.pilot_partnerships
  ADD CONSTRAINT pilot_partnerships_partner_type_check
  CHECK (
    partner_type IN (
      'REAL_ESTATE_AGENCY',
      'PROPERTY_DEVELOPER',
      'PROPERTY_MANAGER',
      'LANDLORD',
      'STUDENT_RESIDENCE',
      'PROPERTY_OWNER',
      'REAL_ESTATE_AGENT',
      'OTHER'
    )
  );
