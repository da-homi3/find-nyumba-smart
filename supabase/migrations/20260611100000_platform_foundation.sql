-- NyumbaSearch foundation schema
-- Idempotent where possible for safe re-runs on fresh projects

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('tenant', 'landlord', 'manager', 'caretaker', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.property_type AS ENUM (
    'bedsitter', 'single_room', 'one_bedroom', 'two_bedroom', 'three_bedroom',
    'studio', 'hostel', 'maisonette', 'bungalow', 'townhouse'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  is_phone_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_id_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_business_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_ownership_verified BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  property_type public.property_type NOT NULL,
  neighborhood TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  rent_kes INTEGER NOT NULL CHECK (rent_kes > 0),
  deposit_kes INTEGER,
  bedrooms INTEGER NOT NULL DEFAULT 1,
  bathrooms INTEGER NOT NULL DEFAULT 1,
  area_sqm INTEGER,
  description TEXT,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  tour_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  authenticity_score INTEGER NOT NULL DEFAULT 70 CHECK (authenticity_score BETWEEN 0 AND 100),
  health_score INTEGER NOT NULL DEFAULT 0 CHECK (health_score BETWEEN 0 AND 100),
  views INTEGER NOT NULL DEFAULT 0,
  available_from DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_properties_active ON public.properties(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_properties_neighborhood ON public.properties(neighborhood);
CREATE INDEX IF NOT EXISTS idx_properties_rent ON public.properties(rent_kes);
CREATE INDEX IF NOT EXISTS idx_properties_owner ON public.properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_geo ON public.properties(latitude, longitude) WHERE latitude IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.property_attributes (
  property_id UUID PRIMARY KEY REFERENCES public.properties(id) ON DELETE CASCADE,
  water_reliability SMALLINT CHECK (water_reliability BETWEEN 1 AND 5),
  security_rating SMALLINT CHECK (security_rating BETWEEN 1 AND 5),
  parking BOOLEAN DEFAULT FALSE,
  pet_friendly BOOLEAN DEFAULT FALSE,
  internet_providers TEXT[] DEFAULT '{}',
  has_borehole BOOLEAN DEFAULT FALSE,
  has_backup_power BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, role)
);

CREATE TABLE IF NOT EXISTS public.saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, property_id)
);

CREATE TABLE IF NOT EXISTS public.property_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  session_id TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  landlord_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'viewing', 'closed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.inquiry_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID NOT NULL REFERENCES public.inquiries(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('phone', 'identity', 'business', 'ownership')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  documents TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.scam_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.property_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating_overall NUMERIC(2,1) NOT NULL CHECK (rating_overall BETWEEN 1 AND 5),
  water_reliability SMALLINT CHECK (water_reliability BETWEEN 1 AND 5),
  security_rating SMALLINT CHECK (security_rating BETWEEN 1 AND 5),
  internet_reliability SMALLINT CHECK (internet_reliability BETWEEN 1 AND 5),
  electricity_reliability SMALLINT CHECK (electricity_reliability BETWEEN 1 AND 5),
  cleanliness SMALLINT CHECK (cleanliness BETWEEN 1 AND 5),
  accessibility SMALLINT CHECK (accessibility BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, reviewer_id)
);

CREATE TABLE IF NOT EXISTS public.neighborhood_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood TEXT NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  noise_level SMALLINT CHECK (noise_level BETWEEN 1 AND 5),
  safety SMALLINT CHECK (safety BETWEEN 1 AND 5),
  traffic SMALLINT CHECK (traffic BETWEEN 1 AND 5),
  water_availability SMALLINT CHECK (water_availability BETWEEN 1 AND 5),
  security SMALLINT CHECK (security BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tenancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'terminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}',
  alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  amount_kes INTEGER NOT NULL CHECK (amount_kes > 0),
  mpesa_receipt TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
  payment_type TEXT NOT NULL CHECK (payment_type IN ('featured_listing', 'premium_subscription', 'property_boost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id UUID,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'agency' CHECK (type IN ('agency', 'property_manager', 'developer')),
  logo_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('owner', 'admin', 'agent')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS public.fraud_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  signal_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  details JSONB DEFAULT '{}',
  resolved BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  );
$$;

-- Drop first: an earlier version of this function has a different return type
DROP FUNCTION IF EXISTS public.record_property_view(UUID, UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.record_property_view(
  _property_id UUID,
  _viewer_id UUID DEFAULT NULL,
  _session_id TEXT DEFAULT NULL,
  _source TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.property_views (property_id, viewer_id, session_id, source)
  VALUES (_property_id, _viewer_id, _session_id, _source);
  UPDATE public.properties SET views = views + 1 WHERE id = _property_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.compute_authenticity_score(_property_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE
  score INTEGER := 50;
  prop RECORD;
  owner_verified INTEGER := 0;
  report_count INTEGER := 0;
  days_old INTEGER;
BEGIN
  SELECT * INTO prop FROM public.properties WHERE id = _property_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF prop.is_verified THEN score := score + 20; END IF;

  SELECT COUNT(*) INTO owner_verified FROM public.verifications
  WHERE user_id = prop.owner_id AND status = 'approved';
  score := score + LEAST(owner_verified * 5, 15);

  SELECT COUNT(*) INTO report_count FROM public.scam_reports
  WHERE property_id = _property_id AND status != 'dismissed';
  score := score - LEAST(report_count * 10, 30);

  days_old := EXTRACT(DAY FROM NOW() - prop.created_at)::INTEGER;
  IF days_old < 7 THEN score := score - 5;
  ELSIF days_old > 30 THEN score := score + 5;
  END IF;

  IF array_length(prop.images, 1) >= 3 THEN score := score + 5; END IF;
  IF prop.latitude IS NOT NULL THEN score := score + 5; END IF;

  RETURN GREATEST(0, LEAST(100, score));
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_update_authenticity_score()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.authenticity_score := public.compute_authenticity_score(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_authenticity_score ON public.properties;
CREATE TRIGGER update_authenticity_score
  BEFORE INSERT OR UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_authenticity_score();

CREATE OR REPLACE FUNCTION public.compute_health_score(_property_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql STABLE SET search_path = public
AS $$
DECLARE
  avg_score NUMERIC;
BEGIN
  SELECT AVG(
    (COALESCE(water_reliability, 3) + COALESCE(security_rating, 3) +
     COALESCE(internet_reliability, 3) + COALESCE(electricity_reliability, 3) +
     COALESCE(cleanliness, 3) + COALESCE(accessibility, 3)) / 6.0 * 20
  ) INTO avg_score
  FROM public.property_reviews WHERE property_id = _property_id;

  RETURN COALESCE(ROUND(avg_score), 0)::INTEGER;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_update_health_score()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.properties
  SET health_score = public.compute_health_score(
    CASE WHEN TG_OP = 'DELETE' THEN OLD.property_id ELSE NEW.property_id END
  )
  WHERE id = CASE WHEN TG_OP = 'DELETE' THEN OLD.property_id ELSE NEW.property_id END;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS update_health_score ON public.property_reviews;
CREATE TRIGGER update_health_score
  AFTER INSERT OR UPDATE OR DELETE ON public.property_reviews
  FOR EACH ROW EXECUTE FUNCTION public.trg_update_health_score();

CREATE OR REPLACE VIEW public.public_profiles AS
  SELECT id, full_name, avatar_url FROM public.profiles;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiry_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scam_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhood_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenancies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active properties" ON public.properties;
CREATE POLICY "Public read active properties" ON public.properties
  FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Owners manage own properties" ON public.properties;
CREATE POLICY "Owners manage own properties" ON public.properties
  FOR ALL USING (auth.uid() = owner_id);

DROP POLICY IF EXISTS "Users read own profile" ON public.profiles;
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users update own profile" ON public.profiles;
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Public read profiles basic" ON public.profiles;
CREATE POLICY "Public read profiles basic" ON public.profiles
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Users manage saved properties" ON public.saved_properties;
CREATE POLICY "Users manage saved properties" ON public.saved_properties
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Participants read inquiries" ON public.inquiries;
CREATE POLICY "Participants read inquiries" ON public.inquiries
  FOR SELECT USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Tenants create inquiries" ON public.inquiries;
CREATE POLICY "Tenants create inquiries" ON public.inquiries
  FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Landlords update inquiry status" ON public.inquiries;
CREATE POLICY "Landlords update inquiry status" ON public.inquiries
  FOR UPDATE USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Public read property reviews" ON public.property_reviews;
CREATE POLICY "Public read property reviews" ON public.property_reviews
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Authenticated users create reviews" ON public.property_reviews;
CREATE POLICY "Authenticated users create reviews" ON public.property_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

DROP POLICY IF EXISTS "Public read neighborhood reviews" ON public.neighborhood_reviews;
CREATE POLICY "Public read neighborhood reviews" ON public.neighborhood_reviews
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Viewings for participants" ON public.viewings;
CREATE POLICY "Viewings for participants" ON public.viewings
  FOR ALL USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Users manage saved searches" ON public.saved_searches;
CREATE POLICY "Users manage saved searches" ON public.saved_searches
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users read own payments" ON public.payments;
CREATE POLICY "Users read own payments" ON public.payments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin full access verifications" ON public.verifications;
CREATE POLICY "Admin full access verifications" ON public.verifications
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Users manage own verifications" ON public.verifications;
CREATE POLICY "Users manage own verifications" ON public.verifications
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Authenticated report scams" ON public.scam_reports;
CREATE POLICY "Authenticated report scams" ON public.scam_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Admin read scam reports" ON public.scam_reports;
CREATE POLICY "Admin read scam reports" ON public.scam_reports
  FOR SELECT USING (public.has_role(auth.uid(), 'admin') OR auth.uid() = reporter_id);
