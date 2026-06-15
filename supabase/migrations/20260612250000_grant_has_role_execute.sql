-- RLS policies reference public.has_role(); authenticated users must be able to
-- execute it when Postgres evaluates those policies (e.g. user_roles SELECT).

GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Split admin write policy so SELECT on user_roles only evaluates the own-row policy.
DROP POLICY IF EXISTS "Admins manage user roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins insert user roles" ON public.user_roles;
CREATE POLICY "Admins insert user roles" ON public.user_roles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins update user roles" ON public.user_roles;
CREATE POLICY "Admins update user roles" ON public.user_roles
  FOR UPDATE USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS "Admins delete user roles" ON public.user_roles;
CREATE POLICY "Admins delete user roles" ON public.user_roles
  FOR DELETE USING (public.has_role(auth.uid(), 'admin'));
