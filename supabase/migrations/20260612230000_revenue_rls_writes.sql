-- Revenue tables: add INSERT/UPDATE/DELETE RLS (SELECT-only policies blocked user writes).

DROP POLICY IF EXISTS "Users insert own subscriptions" ON public.subscriptions;
CREATE POLICY "Users insert own subscriptions" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own subscriptions" ON public.subscriptions;
CREATE POLICY "Users update own subscriptions" ON public.subscriptions
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own subscriptions" ON public.subscriptions;
CREATE POLICY "Users delete own subscriptions" ON public.subscriptions
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own boosts" ON public.listing_boosts;
CREATE POLICY "Users insert own boosts" ON public.listing_boosts
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.properties p
      WHERE p.id = listing_id AND p.owner_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users update own boosts" ON public.listing_boosts;
CREATE POLICY "Users update own boosts" ON public.listing_boosts
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own boosts" ON public.listing_boosts;
CREATE POLICY "Users delete own boosts" ON public.listing_boosts
  FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Landlords read own leads" ON public.leads;
CREATE POLICY "Landlords read own leads" ON public.leads
  FOR SELECT USING (auth.uid() = landlord_id OR auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Tenants insert own leads" ON public.leads;
CREATE POLICY "Tenants insert own leads" ON public.leads
  FOR INSERT WITH CHECK (auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Landlords update own leads" ON public.leads;
CREATE POLICY "Landlords update own leads" ON public.leads
  FOR UPDATE USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Landlords read own transactions" ON public.rental_transactions;
CREATE POLICY "Landlords read own transactions" ON public.rental_transactions
  FOR SELECT USING (auth.uid() = landlord_id OR auth.uid() = tenant_id);

DROP POLICY IF EXISTS "Landlords insert own transactions" ON public.rental_transactions;
CREATE POLICY "Landlords insert own transactions" ON public.rental_transactions
  FOR INSERT WITH CHECK (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Landlords update own transactions" ON public.rental_transactions;
CREATE POLICY "Landlords update own transactions" ON public.rental_transactions
  FOR UPDATE USING (auth.uid() = landlord_id);

DROP POLICY IF EXISTS "Users insert own invoices" ON public.invoices;
CREATE POLICY "Users insert own invoices" ON public.invoices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own invoices" ON public.invoices;
CREATE POLICY "Users update own invoices" ON public.invoices
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own invoices" ON public.invoices;
CREATE POLICY "Users delete own invoices" ON public.invoices
  FOR DELETE USING (auth.uid() = user_id);
