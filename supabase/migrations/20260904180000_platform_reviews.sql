-- Platform reviews (site experience) for footer / marketing surface.
CREATE TABLE IF NOT EXISTS public.platform_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 80),
  rating smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text NOT NULL CHECK (char_length(trim(comment)) BETWEEN 10 AND 800),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS platform_reviews_published_created_idx
  ON public.platform_reviews (created_at DESC)
  WHERE is_published = true;

CREATE UNIQUE INDEX IF NOT EXISTS platform_reviews_one_per_user_idx
  ON public.platform_reviews (user_id)
  WHERE user_id IS NOT NULL;

ALTER TABLE public.platform_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read published platform reviews" ON public.platform_reviews;
CREATE POLICY "Anyone can read published platform reviews"
  ON public.platform_reviews
  FOR SELECT
  TO anon, authenticated
  USING (is_published = true);

-- Inserts go through service role (server functions) — no direct client INSERT.

GRANT SELECT ON public.platform_reviews TO anon, authenticated;
GRANT ALL ON public.platform_reviews TO service_role;
