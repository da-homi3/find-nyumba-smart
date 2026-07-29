-- Universal referral reward system

-- Referral code + referred-by on profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by_user_id UUID REFERENCES profiles(id);
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_credit_kes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bonus_listing_slots INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_referral_code ON profiles(referral_code) WHERE referral_code IS NOT NULL;

-- Config-driven reward rules per role pair
CREATE TABLE IF NOT EXISTS referral_reward_rules (
  id                    TEXT PRIMARY KEY,
  referrer_role         TEXT NOT NULL CHECK(referrer_role IN ('tenant','landlord','agent','agency','provider','property_manager','manager')),
  referred_role         TEXT NOT NULL CHECK(referred_role IN ('tenant','landlord','agent','agency','provider','property_manager','manager')),
  conversion_event      TEXT NOT NULL CHECK(conversion_event IN (
                          'email_verified','first_contact_unlock','first_paid_subscription_month',
                          'first_listing_published','first_pm_module_month'
                        )),
  referrer_reward_type  TEXT NOT NULL CHECK(referrer_reward_type IN ('unlock_credit','listing_slot_bonus','subscription_discount_percent','free_month_extension','cash_credit_kes')),
  referrer_reward_value INTEGER NOT NULL,
  referred_reward_type  TEXT CHECK(referred_reward_type IN ('unlock_credit','listing_slot_bonus','subscription_discount_percent','free_month_extension','cash_credit_kes','trial_extension_days')),
  referred_reward_value INTEGER,
  active                INTEGER NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed defaults
INSERT INTO referral_reward_rules
  (id, referrer_role, referred_role, conversion_event, referrer_reward_type, referrer_reward_value, referred_reward_type, referred_reward_value) VALUES
('rr-01', 'tenant', 'tenant', 'first_contact_unlock', 'unlock_credit', 2, 'unlock_credit', 1),
('rr-02', 'tenant', 'landlord', 'first_listing_published', 'unlock_credit', 3, 'trial_extension_days', 7),
('rr-03', 'landlord', 'landlord', 'first_paid_subscription_month', 'listing_slot_bonus', 2, 'listing_slot_bonus', 1),
('rr-04', 'landlord', 'tenant', 'first_contact_unlock', 'cash_credit_kes', 100, 'unlock_credit', 1),
('rr-05', 'manager', 'manager', 'first_pm_module_month', 'subscription_discount_percent', 10, 'subscription_discount_percent', 10),
('rr-06', 'manager', 'agency', 'first_pm_module_month', 'subscription_discount_percent', 10, 'subscription_discount_percent', 10),
('rr-07', 'agency', 'agency', 'first_paid_subscription_month', 'free_month_extension', 1, 'free_month_extension', 1),
('rr-08', 'agency', 'landlord', 'first_paid_subscription_month', 'free_month_extension', 1, 'trial_extension_days', 14),
('rr-09', 'provider', 'provider', 'first_pm_module_month', 'subscription_discount_percent', 15, 'subscription_discount_percent', 15)
ON CONFLICT (id) DO NOTHING;

-- Individual referral tracking
CREATE TABLE IF NOT EXISTS referrals (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_user_id          UUID NOT NULL REFERENCES profiles(id),
  referred_user_id          UUID NOT NULL REFERENCES profiles(id),
  referrer_role_at_referral TEXT NOT NULL,
  referred_role_at_referral TEXT NOT NULL,
  rule_id                   TEXT REFERENCES referral_reward_rules(id),
  status                    TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','converted','expired','fraud_flagged')),
  converted_at              TIMESTAMPTZ,
  referrer_reward_granted   BOOLEAN NOT NULL DEFAULT FALSE,
  referred_reward_granted   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_unique_pair ON referrals(referrer_user_id, referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id, status);

-- Auditable reward ledger
CREATE TABLE IF NOT EXISTS referral_reward_ledger (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id   UUID NOT NULL REFERENCES referrals(id),
  user_id       UUID NOT NULL REFERENCES profiles(id),
  reward_type   TEXT NOT NULL,
  reward_value  INTEGER NOT NULL,
  applied       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reward_ledger_user ON referral_reward_ledger(user_id);

-- Pending renewal discounts (applied on next billing cycle)
CREATE TABLE IF NOT EXISTS pending_renewal_discounts (
  user_id          UUID PRIMARY KEY REFERENCES profiles(id),
  discount_percent INTEGER NOT NULL CHECK(discount_percent > 0 AND discount_percent <= 100),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE referral_reward_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_reward_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_renewal_discounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own referrals" ON referrals FOR SELECT USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);
CREATE POLICY "Anyone can read active rules" ON referral_reward_rules FOR SELECT USING (active = 1);
CREATE POLICY "Users can read own rewards" ON referral_reward_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service role full access referrals" ON referrals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access ledger" ON referral_reward_ledger FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access rules" ON referral_reward_rules FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access discounts" ON pending_renewal_discounts FOR ALL USING (auth.role() = 'service_role');
