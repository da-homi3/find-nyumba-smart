CREATE TABLE IF NOT EXISTS public.partnership_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_type TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  company TEXT,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_partnership_inquiries_type ON public.partnership_inquiries (inquiry_type, created_at DESC);

ALTER TABLE public.partnership_inquiries ENABLE ROW LEVEL SECURITY;
