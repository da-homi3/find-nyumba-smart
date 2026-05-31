
-- Roles enum + table
CREATE TYPE public.app_role AS ENUM ('tenant', 'landlord', 'manager', 'caretaker', 'admin');

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Properties
CREATE TYPE public.property_type AS ENUM ('bedsitter', 'single_room', 'one_bedroom', 'two_bedroom', 'three_bedroom', 'studio', 'hostel', 'maisonette', 'bungalow', 'townhouse');

CREATE TABLE public.properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  property_type property_type NOT NULL,
  neighborhood TEXT NOT NULL,
  address TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  rent_kes INTEGER NOT NULL,
  deposit_kes INTEGER,
  bedrooms INTEGER NOT NULL DEFAULT 0,
  bathrooms INTEGER NOT NULL DEFAULT 1,
  area_sqm INTEGER,
  description TEXT,
  amenities TEXT[] NOT NULL DEFAULT '{}',
  images TEXT[] NOT NULL DEFAULT '{}',
  video_url TEXT,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  available_from DATE,
  views INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_properties_neighborhood ON public.properties(neighborhood);
CREATE INDEX idx_properties_rent ON public.properties(rent_kes);
CREATE INDEX idx_properties_owner ON public.properties(owner_id);

CREATE TABLE public.saved_properties (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);

CREATE TABLE public.inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  landlord_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO anon;
GRANT ALL ON public.profiles TO service_role;

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

GRANT SELECT ON public.properties TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;

GRANT SELECT, INSERT, DELETE ON public.saved_properties TO authenticated;
GRANT ALL ON public.saved_properties TO service_role;

GRANT SELECT, INSERT, UPDATE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;

-- RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- Roles policies (read own roles)
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Properties policies
CREATE POLICY "Active properties are viewable by everyone" ON public.properties FOR SELECT USING (is_active = true OR auth.uid() = owner_id);
CREATE POLICY "Landlords can insert their own properties" ON public.properties FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id AND public.has_role(auth.uid(), 'landlord'));
CREATE POLICY "Landlords can update their own properties" ON public.properties FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "Landlords can delete their own properties" ON public.properties FOR DELETE TO authenticated USING (auth.uid() = owner_id);

-- Saved properties
CREATE POLICY "Users view own saved" ON public.saved_properties FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users save properties" ON public.saved_properties FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users unsave properties" ON public.saved_properties FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Inquiries
CREATE POLICY "Tenants view own inquiries" ON public.inquiries FOR SELECT TO authenticated USING (auth.uid() = tenant_id OR auth.uid() = landlord_id);
CREATE POLICY "Tenants create inquiries" ON public.inquiries FOR INSERT TO authenticated WITH CHECK (auth.uid() = tenant_id);
CREATE POLICY "Landlords update inquiry status" ON public.inquiries FOR UPDATE TO authenticated USING (auth.uid() = landlord_id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone');

  -- Assign role based on signup metadata (default tenant)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'tenant'::app_role)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER properties_updated_at BEFORE UPDATE ON public.properties FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
