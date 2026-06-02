
DROP FUNCTION IF EXISTS public.record_property_view(uuid, uuid, text, text);

CREATE OR REPLACE FUNCTION public.record_property_view(
  _property_id uuid,
  _viewer_id uuid DEFAULT NULL,
  _session_id text DEFAULT NULL,
  _source text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.property_views (property_id, viewer_id, session_id, source)
  VALUES (_property_id, _viewer_id, _session_id, _source);
  UPDATE public.properties SET views = views + 1 WHERE id = _property_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_property_view(uuid, uuid, text, text) TO anon, authenticated, service_role;

-- Allow inserts so SECURITY INVOKER works for both anon and authenticated viewers
DROP POLICY IF EXISTS "Anyone can insert property views" ON public.property_views;
CREATE POLICY "Anyone can insert property views"
ON public.property_views FOR INSERT TO anon, authenticated
WITH CHECK (true);
