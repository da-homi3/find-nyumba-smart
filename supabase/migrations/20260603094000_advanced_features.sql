-- Migration for Nyumba Search Advanced Features (Phases 1-14)

-- 1) Add new columns to profiles & properties for caching verification and quality scores
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_phone_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_id_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_business_verified BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_ownership_verified BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS authenticity_score INTEGER NOT NULL DEFAULT 70,
  ADD COLUMN IF NOT EXISTS health_score INTEGER NOT NULL DEFAULT 70;

-- 2) Create verifications table
CREATE TABLE IF NOT EXISTS public.verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('phone', 'identity', 'business', 'ownership')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  documents TEXT[] NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_verifications_user ON public.verifications(user_id);

-- 3) Create property reviews table
CREATE TABLE IF NOT EXISTS public.property_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating_overall NUMERIC NOT NULL CHECK (rating_overall >= 1.0 AND rating_overall <= 5.0),
  water_reliability INTEGER NOT NULL CHECK (water_reliability >= 1 AND water_reliability <= 5),
  security_rating INTEGER NOT NULL CHECK (security_rating >= 1 AND security_rating <= 5),
  internet_reliability INTEGER NOT NULL CHECK (internet_reliability >= 1 AND internet_reliability <= 5),
  electricity_reliability INTEGER NOT NULL CHECK (electricity_reliability >= 1 AND electricity_reliability <= 5),
  cleanliness INTEGER NOT NULL CHECK (cleanliness >= 1 AND cleanliness <= 5),
  accessibility INTEGER NOT NULL CHECK (accessibility >= 1 AND accessibility <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(property_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_property_reviews_property ON public.property_reviews(property_id);

-- 4) Create neighborhood reviews table
CREATE TABLE IF NOT EXISTS public.neighborhood_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  neighborhood TEXT NOT NULL,
  reviewer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  noise_level INTEGER NOT NULL CHECK (noise_level >= 1 AND noise_level <= 5),
  safety INTEGER NOT NULL CHECK (safety >= 1 AND safety <= 5),
  traffic INTEGER NOT NULL CHECK (traffic >= 1 AND traffic <= 5),
  water_availability INTEGER NOT NULL CHECK (water_availability >= 1 AND water_availability <= 5),
  security INTEGER NOT NULL CHECK (security >= 1 AND security <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(neighborhood, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_neighborhood_reviews_name ON public.neighborhood_reviews(neighborhood);

-- 5) Create scam reports table
CREATE TABLE IF NOT EXISTS public.scam_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'reviewed', 'dismissed')) DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scam_reports_property ON public.scam_reports(property_id);

-- 6) Create viewings table
CREATE TABLE IF NOT EXISTS public.viewings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  landlord_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed')) DEFAULT 'pending',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_viewings_tenant ON public.viewings(tenant_id);
CREATE INDEX IF NOT EXISTS idx_viewings_landlord ON public.viewings(landlord_id);

-- 7) Create saved_searches table
CREATE TABLE IF NOT EXISTS public.saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  criteria JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON public.saved_searches(user_id);

-- 8) Create payments table
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  amount_kes INTEGER NOT NULL,
  mpesa_receipt TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'failed')) DEFAULT 'pending',
  payment_type TEXT NOT NULL CHECK (payment_type IN ('featured_listing', 'premium_subscription', 'property_boost')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payments_user ON public.payments(user_id);

-- 9) Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_id TEXT,
  details TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Triggers for updated_at
CREATE TRIGGER verifications_updated_at BEFORE UPDATE ON public.verifications FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER viewings_updated_at BEFORE UPDATE ON public.viewings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 10) Security DEFINER triggers to update profiles/properties calculated fields

-- Update profile flags on verification approved/rejected
CREATE OR REPLACE FUNCTION public.sync_profile_verifications()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
BEGIN
  v_user_id := COALESCE(NEW.user_id, OLD.user_id);

  UPDATE public.profiles
  SET
    is_phone_verified = EXISTS (
      SELECT 1 FROM public.verifications 
      WHERE user_id = v_user_id AND verification_type = 'phone' AND status = 'approved'
    ),
    is_id_verified = EXISTS (
      SELECT 1 FROM public.verifications 
      WHERE user_id = v_user_id AND verification_type = 'identity' AND status = 'approved'
    ),
    is_business_verified = EXISTS (
      SELECT 1 FROM public.verifications 
      WHERE user_id = v_user_id AND verification_type = 'business' AND status = 'approved'
    ),
    is_ownership_verified = EXISTS (
      SELECT 1 FROM public.verifications 
      WHERE user_id = v_user_id AND verification_type = 'ownership' AND status = 'approved'
    )
  WHERE id = v_user_id;

  -- Re-calculate score of properties belonging to this landlord
  PERFORM public.recalculate_landlord_property_scores(v_user_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.recalculate_landlord_property_scores(p_landlord_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.properties
  SET authenticity_score = public.calculate_authenticity_score(id)
  WHERE owner_id = p_landlord_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_verification_change
  AFTER INSERT OR UPDATE OR DELETE ON public.verifications
  FOR EACH ROW EXECUTE FUNCTION public.sync_profile_verifications();

-- Authenticity Score calculation logic
CREATE OR REPLACE FUNCTION public.calculate_authenticity_score(p_property_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_owner_id UUID;
  v_score INTEGER := 50; -- Base score
  v_phone_ver BOOLEAN := false;
  v_id_ver BOOLEAN := false;
  v_bus_ver BOOLEAN := false;
  v_own_ver BOOLEAN := false;
  v_report_count INTEGER := 0;
  v_avg_rating NUMERIC := 0;
BEGIN
  -- Fetch property metadata
  SELECT owner_id INTO v_owner_id FROM public.properties WHERE id = p_property_id;
  
  IF v_owner_id IS NOT NULL THEN
    SELECT is_phone_verified, is_id_verified, is_business_verified, is_ownership_verified
    INTO v_phone_ver, v_id_ver, v_bus_ver, v_own_ver
    FROM public.profiles
    WHERE id = v_owner_id;
  END IF;

  -- Add points for verifications
  IF v_phone_ver THEN v_score := v_score + 10; END IF;
  IF v_id_ver THEN v_score := v_score + 15; END IF;
  IF v_bus_ver THEN v_score := v_score + 15; END IF;
  IF v_own_ver THEN v_score := v_score + 20; END IF;

  -- Subtract points for active fraud/scam reports
  SELECT COUNT(*) INTO v_report_count FROM public.scam_reports WHERE property_id = p_property_id AND status = 'pending';
  v_score := v_score - (v_report_count * 20);

  -- Adjust based on review rating
  SELECT COALESCE(AVG(rating_overall), 0) INTO v_avg_rating FROM public.property_reviews WHERE property_id = p_property_id;
  IF v_avg_rating > 0 THEN
    v_score := v_score + ((v_avg_rating - 3) * 10)::INTEGER;
  END IF;

  RETURN LEAST(100, GREATEST(0, v_score));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Quality/Health Score calculation logic
CREATE OR REPLACE FUNCTION public.calculate_health_score(p_property_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_avg_water NUMERIC;
  v_avg_sec NUMERIC;
  v_avg_int NUMERIC;
  v_avg_elec NUMERIC;
  v_avg_clean NUMERIC;
  v_avg_acc NUMERIC;
  v_avg_overall NUMERIC;
  v_score INTEGER := 70; -- Base heuristic
BEGIN
  SELECT 
    AVG(water_reliability),
    AVG(security_rating),
    AVG(internet_reliability),
    AVG(electricity_reliability),
    AVG(cleanliness),
    AVG(accessibility)
  INTO 
    v_avg_water,
    v_avg_sec,
    v_avg_int,
    v_avg_elec,
    v_avg_clean,
    v_avg_acc
  FROM public.property_reviews 
  WHERE property_id = p_property_id;

  IF v_avg_water IS NOT NULL THEN
    v_avg_overall := (v_avg_water + v_avg_sec + v_avg_int + v_avg_elec + v_avg_clean + v_avg_acc) / 6.0;
    v_score := (v_avg_overall * 20)::INTEGER;
  END IF;

  RETURN LEAST(100, GREATEST(0, v_score));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to recalculate scores when reviews/reports change
CREATE OR REPLACE FUNCTION public.sync_property_scores()
RETURNS TRIGGER AS $$
DECLARE
  v_prop_id UUID;
BEGIN
  v_prop_id := COALESCE(NEW.property_id, OLD.property_id);

  UPDATE public.properties
  SET
    authenticity_score = public.calculate_authenticity_score(v_prop_id),
    health_score = public.calculate_health_score(v_prop_id)
  WHERE id = v_prop_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON public.property_reviews
  FOR EACH ROW EXECUTE FUNCTION public.sync_property_scores();

CREATE TRIGGER on_scam_report_change
  AFTER INSERT OR UPDATE OR DELETE ON public.scam_reports
  FOR EACH ROW EXECUTE FUNCTION public.sync_property_scores();

-- 11) Enable Row-Level Security (RLS) on all new tables
ALTER TABLE public.verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.neighborhood_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scam_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

-- 12) RLS Policies

-- verifications: Users see/edit own; Admins see/edit all.
CREATE POLICY "Users view own verifications" ON public.verifications FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users insert own verifications" ON public.verifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins update verifications" ON public.verifications FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- property_reviews: Anyone views; Authenticated tenants create.
CREATE POLICY "Reviews viewable by everyone" ON public.property_reviews FOR SELECT USING (true);
CREATE POLICY "Tenants create reviews" ON public.property_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id AND public.has_role(auth.uid(), 'tenant'));

-- neighborhood_reviews: Anyone views; Authenticated tenants create.
CREATE POLICY "Neighbourhood reviews viewable by everyone" ON public.neighborhood_reviews FOR SELECT USING (true);
CREATE POLICY "Tenants create neighborhood reviews" ON public.neighborhood_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() = reviewer_id AND public.has_role(auth.uid(), 'tenant'));

-- scam_reports: Admins view/edit; Users insert.
CREATE POLICY "Admins view scam reports" ON public.scam_reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users report scams" ON public.scam_reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins update scam reports" ON public.scam_reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- viewings: Tenant & Landlord view/update.
CREATE POLICY "Viewings viewable by participants" ON public.viewings FOR SELECT TO authenticated USING (auth.uid() = tenant_id OR auth.uid() = landlord_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Tenants book viewings" ON public.viewings FOR INSERT TO authenticated WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "Participants update viewings" ON public.viewings FOR UPDATE TO authenticated USING (auth.uid() = tenant_id OR auth.uid() = landlord_id OR public.has_role(auth.uid(), 'admin'));

-- saved_searches: User private access.
CREATE POLICY "Users manage own saved searches" ON public.saved_searches FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- payments: User views own; Admins view all; Users insert.
CREATE POLICY "Users view own payments" ON public.payments FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users initiate payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- admin_audit_logs: Admins only.
CREATE POLICY "Admins manage audit logs" ON public.admin_audit_logs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- 13) Grants
GRANT SELECT ON public.verifications TO authenticated;
GRANT SELECT ON public.property_reviews TO anon, authenticated;
GRANT SELECT ON public.neighborhood_reviews TO anon, authenticated;
GRANT SELECT, INSERT ON public.scam_reports TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.viewings TO authenticated;
GRANT ALL ON public.saved_searches TO authenticated;
GRANT SELECT, INSERT ON public.payments TO authenticated;

GRANT ALL ON public.verifications TO service_role;
GRANT ALL ON public.property_reviews TO service_role;
GRANT ALL ON public.neighborhood_reviews TO service_role;
GRANT ALL ON public.scam_reports TO service_role;
GRANT ALL ON public.viewings TO service_role;
GRANT ALL ON public.saved_searches TO service_role;
GRANT ALL ON public.payments TO service_role;
GRANT ALL ON public.admin_audit_logs TO service_role;
