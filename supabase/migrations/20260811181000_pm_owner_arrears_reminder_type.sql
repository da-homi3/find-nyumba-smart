-- Allow daily owner arrears digest keys (owner_arrears_YYYY-MM-DD) on reminder log.
DO $$
DECLARE
  cname text;
BEGIN
  SELECT conname INTO cname
  FROM pg_constraint
  WHERE conrelid = 'public.pm_rent_reminder_log'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%reminder_type%';
  IF cname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pm_rent_reminder_log DROP CONSTRAINT %I', cname);
  END IF;
END $$;

ALTER TABLE public.pm_rent_reminder_log
  ADD CONSTRAINT pm_rent_reminder_log_reminder_type_check
  CHECK (
    reminder_type IN ('upcoming', 'due_today', 'overdue_3day', 'overdue_7day')
    OR reminder_type LIKE 'owner_arrears_%'
  );
