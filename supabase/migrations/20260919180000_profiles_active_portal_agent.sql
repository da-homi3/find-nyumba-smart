-- Allow agent + property_developer as profiles.active_portal values.

DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_active_portal_check;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_active_portal_check
  CHECK (
    active_portal IS NULL
    OR active_portal IN (
      'tenant',
      'landlord',
      'manager',
      'agency',
      'caretaker',
      'admin',
      'property_developer',
      'agent'
    )
  );
