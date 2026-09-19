-- Atomic Plus contact credit consumption (prevents race double-spend).

CREATE OR REPLACE FUNCTION public.consume_plus_contact_credits(_user_id uuid, _cost integer)
RETURNS TABLE(ok boolean, remaining integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  next_credits integer;
  normalized_cost integer := GREATEST(1, COALESCE(_cost, 1));
BEGIN
  UPDATE public.profiles
  SET plus_contact_credits = plus_contact_credits - normalized_cost
  WHERE id = _user_id
    AND plus_contact_credits >= normalized_cost
  RETURNING plus_contact_credits INTO next_credits;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      false,
      COALESCE(
        (SELECT p.plus_contact_credits FROM public.profiles p WHERE p.id = _user_id),
        0
      );
    RETURN;
  END IF;

  RETURN QUERY SELECT true, next_credits;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_plus_contact_credits(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_plus_contact_credits(uuid, integer) TO service_role;
