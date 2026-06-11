-- Bootstrap profiles + user_roles when auth users are created (and backfill existing users)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  chosen_role public.app_role;
  meta_role TEXT;
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (
    NEW.id,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'full_name', '')), ''),
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    updated_at = NOW();

  meta_role := LOWER(COALESCE(NEW.raw_user_meta_data->>'role', 'tenant'));
  chosen_role := CASE meta_role
    WHEN 'landlord' THEN 'landlord'::public.app_role
    WHEN 'manager' THEN 'manager'::public.app_role
    WHEN 'caretaker' THEN 'caretaker'::public.app_role
    WHEN 'admin' THEN 'admin'::public.app_role
    ELSE 'tenant'::public.app_role
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, chosen_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for users created before this migration
INSERT INTO public.profiles (id, full_name, phone)
SELECT
  u.id,
  NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'full_name', '')), ''),
  NULLIF(TRIM(COALESCE(u.raw_user_meta_data->>'phone', '')), '')
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id);

-- Backfill default tenant role where missing
INSERT INTO public.user_roles (user_id, role)
SELECT
  u.id,
  CASE LOWER(COALESCE(u.raw_user_meta_data->>'role', 'tenant'))
    WHEN 'landlord' THEN 'landlord'::public.app_role
    WHEN 'manager' THEN 'manager'::public.app_role
    WHEN 'caretaker' THEN 'caretaker'::public.app_role
    WHEN 'admin' THEN 'admin'::public.app_role
    ELSE 'tenant'::public.app_role
  END
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = u.id);
