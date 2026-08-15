-- Fix landlord/agency listing inserts broken by 20260805160000_close_pii_exposure.
--
-- That migration revoked table-level SELECT on public.properties and re-granted
-- column SELECT excluding contact_*. The BEFORE INSERT authenticity trigger still
-- ran `SELECT * FROM public.properties`, which requires SELECT on every column
-- (including contact_*), so authenticated inserts failed with:
--   permission denied for table properties (42501)
--
-- Fix: compute score as SECURITY DEFINER and read only the non-PII columns needed.

CREATE OR REPLACE FUNCTION public.compute_authenticity_score(_property_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score INTEGER := 50;
  prop RECORD;
  owner_verified INTEGER := 0;
  report_count INTEGER := 0;
  days_old INTEGER;
BEGIN
  SELECT
    is_verified,
    owner_id,
    created_at,
    images,
    latitude
  INTO prop
  FROM public.properties
  WHERE id = _property_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  IF prop.is_verified THEN
    score := score + 20;
  END IF;

  SELECT COUNT(*) INTO owner_verified
  FROM public.verifications
  WHERE user_id = prop.owner_id AND status = 'approved';
  score := score + LEAST(owner_verified * 5, 15);

  SELECT COUNT(*) INTO report_count
  FROM public.scam_reports
  WHERE property_id = _property_id AND status != 'dismissed';
  score := score - LEAST(report_count * 10, 30);

  days_old := EXTRACT(DAY FROM NOW() - prop.created_at)::INTEGER;
  IF days_old < 7 THEN
    score := score - 5;
  ELSIF days_old > 30 THEN
    score := score + 5;
  END IF;

  IF array_length(prop.images, 1) >= 3 THEN
    score := score + 5;
  END IF;
  IF prop.latitude IS NOT NULL THEN
    score := score + 5;
  END IF;

  RETURN GREATEST(0, LEAST(100, score));
END;
$$;

-- Prefer NEW row fields on INSERT/UPDATE so BEFORE INSERT does not depend on the
-- not-yet-visible row; fall back to the definer function for owner/report lookups.
CREATE OR REPLACE FUNCTION public.trg_update_authenticity_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  score INTEGER := 50;
  owner_verified INTEGER := 0;
  report_count INTEGER := 0;
  days_old INTEGER;
BEGIN
  IF NEW.is_verified THEN
    score := score + 20;
  END IF;

  SELECT COUNT(*) INTO owner_verified
  FROM public.verifications
  WHERE user_id = NEW.owner_id AND status = 'approved';
  score := score + LEAST(owner_verified * 5, 15);

  IF NEW.id IS NOT NULL THEN
    SELECT COUNT(*) INTO report_count
    FROM public.scam_reports
    WHERE property_id = NEW.id AND status != 'dismissed';
    score := score - LEAST(report_count * 10, 30);
  END IF;

  days_old := EXTRACT(DAY FROM NOW() - COALESCE(NEW.created_at, NOW()))::INTEGER;
  IF days_old < 7 THEN
    score := score - 5;
  ELSIF days_old > 30 THEN
    score := score + 5;
  END IF;

  IF array_length(NEW.images, 1) >= 3 THEN
    score := score + 5;
  END IF;
  IF NEW.latitude IS NOT NULL THEN
    score := score + 5;
  END IF;

  NEW.authenticity_score := GREATEST(0, LEAST(100, score));
  RETURN NEW;
END;
$$;

-- Health score updates properties from review triggers; keep DEFINER so it can UPDATE
-- after column-level SELECT lockdown.
CREATE OR REPLACE FUNCTION public.trg_update_health_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.properties
  SET health_score = public.compute_health_score(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.property_id ELSE NEW.property_id END
  )
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.property_id ELSE NEW.property_id END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

REVOKE ALL ON FUNCTION public.compute_authenticity_score(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.compute_authenticity_score(UUID) TO authenticated, service_role;
