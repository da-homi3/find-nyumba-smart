-- Client upserts on profiles fail: PostgREST ON CONFLICT still needs INSERT
-- on every column it sends, while authenticated only has INSERT on a few
-- identity columns. Grant the timestamp columns used on insert, and keep
-- entitlement columns revoked.

REVOKE INSERT ON public.profiles FROM authenticated;
GRANT INSERT (id, full_name, phone, avatar_url, active_portal, created_at, updated_at)
  ON public.profiles TO authenticated;

REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name, phone, avatar_url, active_portal, updated_at)
  ON public.profiles TO authenticated;
