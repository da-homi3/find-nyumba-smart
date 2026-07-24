-- Reduce tenant free contact unlocks from 3 → 2

ALTER TABLE public.profiles
  ALTER COLUMN trial_unlocks_remaining SET DEFAULT 2;

-- Cap unused legacy allotments; leave already-spent balances (0–2) alone.
UPDATE public.profiles
SET trial_unlocks_remaining = 2
WHERE trial_unlocks_remaining > 2;
