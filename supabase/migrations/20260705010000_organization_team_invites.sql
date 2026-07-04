-- Allow pending team invites on organization_members
-- Fixes: organization_members_role_check rejects role='pending'

ALTER TABLE public.organization_members
  DROP CONSTRAINT IF EXISTS organization_members_role_check;

ALTER TABLE public.organization_members
  ADD CONSTRAINT organization_members_role_check
  CHECK (role IN ('owner', 'member', 'pending'));

-- RLS: each user can read their own membership (pending gate, org context)
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organization_members_select_same_org" ON public.organization_members;
DROP POLICY IF EXISTS "organization_members_select_own" ON public.organization_members;
CREATE POLICY "organization_members_select_own"
  ON public.organization_members
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
