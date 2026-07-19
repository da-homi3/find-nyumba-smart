-- Google OAuth users often send name/picture instead of full_name/avatar_url.
-- Default role remains tenant when metadata.role is absent.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  meta_role TEXT;
  org_name TEXT;
  display_name TEXT;
  avatar TEXT;
BEGIN
  display_name := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    ''
  )), '');
  avatar := NULLIF(TRIM(COALESCE(
    NEW.raw_user_meta_data->>'avatar_url',
    NEW.raw_user_meta_data->>'picture',
    ''
  )), '');

  INSERT INTO public.profiles (id, full_name, phone, avatar_url, active_portal)
  VALUES (
    NEW.id,
    display_name,
    NULLIF(TRIM(COALESCE(NEW.raw_user_meta_data->>'phone', '')), ''),
    avatar,
    'tenant'
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
    phone = COALESCE(EXCLUDED.phone, profiles.phone),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
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
