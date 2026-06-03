
-- 1) Hardcode role to 'tenant' in handle_new_user trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');

  -- SECURITY: role is hardcoded to 'tenant'. Do NOT read from raw_user_meta_data
  -- since clients control that during signUp(). Landlord/admin upgrades must
  -- happen via an admin-only process (service_role or dashboard).
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'tenant'::public.app_role);
  RETURN NEW;
END;
$function$;

-- 2) Replace permissive WITH CHECK(true) policy on property_views.
--    Make record_property_view SECURITY DEFINER and require it for inserts.
DROP POLICY IF EXISTS "Anyone can insert property views" ON public.property_views;

CREATE OR REPLACE FUNCTION public.record_property_view(
  _property_id uuid,
  _viewer_id uuid DEFAULT NULL,
  _session_id text DEFAULT NULL,
  _source text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate the property exists and is active before recording a view.
  IF NOT EXISTS (
    SELECT 1 FROM public.properties
    WHERE id = _property_id AND is_active = true
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.property_views (property_id, viewer_id, session_id, source)
  VALUES (_property_id, _viewer_id, _session_id, _source);

  UPDATE public.properties SET views = views + 1 WHERE id = _property_id;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_property_view(uuid, uuid, text, text)
  TO anon, authenticated;
