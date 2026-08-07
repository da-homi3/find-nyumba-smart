-- referral_reward_rules was readable by anon via "Anyone can read active rules"
-- (SELECT TO public USING (active = 1)), exposing the referral reward economics — reward
-- types and payout values for every referrer/referred role combination.
--
-- Both server reads use the service role (trackReferralSignup in auth.functions.ts and
-- conversion.ts, via asLooseDb(supabaseAdmin)), and the referrals UI does not query this
-- table directly, so nothing depends on public access.

DROP POLICY IF EXISTS "Anyone can read active rules" ON public.referral_reward_rules;

-- Service-role reads bypass RLS and grants, so these clients are unaffected.
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.referral_reward_rules FROM anon, authenticated;
