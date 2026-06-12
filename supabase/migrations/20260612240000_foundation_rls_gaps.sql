-- Foundation RLS gaps: user_roles, inquiry_messages, fraud_signals, push_tokens
-- + compute_authenticity_score volatility fix

ALTER TABLE public.fraud_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own roles" ON public.user_roles;
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage user roles" ON public.user_roles;
CREATE POLICY "Admins manage user roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Inquiry participants read messages" ON public.inquiry_messages;
CREATE POLICY "Inquiry participants read messages" ON public.inquiry_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
        AND (i.tenant_id = auth.uid() OR i.landlord_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Inquiry participants send messages" ON public.inquiry_messages;
CREATE POLICY "Inquiry participants send messages" ON public.inquiry_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
        AND (i.tenant_id = auth.uid() OR i.landlord_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Recipients mark messages read" ON public.inquiry_messages;
CREATE POLICY "Recipients mark messages read" ON public.inquiry_messages
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.inquiries i
      WHERE i.id = inquiry_id
        AND (i.tenant_id = auth.uid() OR i.landlord_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins manage fraud signals" ON public.fraud_signals;
CREATE POLICY "Admins manage fraud signals" ON public.fraud_signals
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Owners read fraud signals on own listings" ON public.fraud_signals;
CREATE POLICY "Owners read fraud signals on own listings" ON public.fraud_signals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = fraud_signals.property_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users manage own push tokens" ON public.push_tokens
  FOR ALL USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.compute_authenticity_score(_property_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql VOLATILE SET search_path = public
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
