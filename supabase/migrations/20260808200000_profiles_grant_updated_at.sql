-- Fix: profile Settings save failed with "permission denied for table profiles".
-- Column-level UPDATE grants omitted `updated_at`, but profiles_updated_at trigger
-- (SECURITY INVOKER set_updated_at) writes NEW.updated_at on every UPDATE.

GRANT UPDATE (
  full_name,
  phone,
  avatar_url,
  active_portal,
  updated_at
) ON public.profiles TO authenticated;

-- Keep INSERT limited to identity/contact fields (id cannot be updated).
GRANT INSERT (
  id,
  full_name,
  phone,
  avatar_url,
  active_portal
) ON public.profiles TO authenticated;
