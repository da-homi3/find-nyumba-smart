-- Fix recursive RLS on organization_members (owners list team via server admin client)
DROP POLICY IF EXISTS "organization_members_select_same_org" ON public.organization_members;

DROP POLICY IF EXISTS "organization_members_select_own" ON public.organization_members;
CREATE POLICY "organization_members_select_own"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
