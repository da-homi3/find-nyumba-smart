-- Reduce tenant free contact unlocks from 2 → 1

ALTER TABLE public.profiles
  ALTER COLUMN trial_unlocks_remaining SET DEFAULT 1;

-- Cap unused legacy allotments; leave already-spent balances (0–1) alone.
UPDATE public.profiles
SET trial_unlocks_remaining = 1
WHERE trial_unlocks_remaining > 1;
