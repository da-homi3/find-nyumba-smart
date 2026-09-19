-- Allow portal applications for property_developer + agent (and other app_role values).

DO $$
BEGIN
  ALTER TABLE public.portal_applications DROP CONSTRAINT IF EXISTS portal_applications_requested_role_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.portal_applications
  ADD CONSTRAINT portal_applications_requested_role_check
  CHECK (
    requested_role::text IN (
      'landlord',
      'manager',
      'agency',
      'property_developer',
      'agent',
      'caretaker',
      'admin',
      'tenant'
    )
  );
