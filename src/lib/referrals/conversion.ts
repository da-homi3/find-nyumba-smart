import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Admin = SupabaseClient<Database>;

type ReferralRow = {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referrer_role_at_referral: string;
  referred_role_at_referral: string;
  rule_id: string | null;
  status: string;
};

type RuleRow = {
  id: string;
  referrer_reward_type: string;
  referrer_reward_value: number;
  referred_reward_type: string | null;
  referred_reward_value: number | null;
  conversion_event: string;
};

/**
 * Called from existing event handlers (contact-unlock, subscription payment,
 * listing publish, PM module activation). Checks whether the user has a
 * pending referral whose conversion_event matches, and if so grants rewards.
 */
export async function checkReferralConversion(
  admin: Admin,
  userId: string,
  event: string,
): Promise<void> {
  try {
    const { data: referral } = await (admin as SupabaseClient<any>)
      .from("referrals")
      .select("*")
      .eq("referred_user_id", userId)
      .eq("status", "pending")
      .maybeSingle();

    if (!referral?.rule_id) return;

    const { data: rule } = await (admin as SupabaseClient<any>)
      .from("referral_reward_rules")
      .select("*")
      .eq("id", referral.rule_id)
      .eq("conversion_event", event)
      .eq("active", 1)
      .maybeSingle();

    if (!rule) return;

    const { flagSuspiciousReferral, referrerAtCap } = await import("@/lib/referrals/fraud-check");
    const flagged = await flagSuspiciousReferral(admin, referral);
    if (flagged) return;

    const capped = await referrerAtCap(admin, referral.referrer_user_id);
    if (capped) return;

    await grantReferralRewards(admin, referral as ReferralRow, rule as RuleRow);

    await (admin as SupabaseClient<any>)
      .from("referrals")
      .update({ status: "converted", converted_at: new Date().toISOString() })
      .eq("id", referral.id);

    // Award loyalty points to referrer
    try {
      const { awardPoints } = await import("@/lib/loyalty/points");
      await awardPoints(admin, {
        userId: referral.referrer_user_id,
        reason: "referral_converted",
        relatedId: referral.id,
      });
    } catch {
      // non-critical
    }

    await notifyReferralConverted(admin, referral as ReferralRow);
  } catch (err) {
    console.warn("[referrals] conversion check failed:", err);
  }
}

async function grantReferralRewards(
  admin: Admin,
  referral: ReferralRow,
  rule: RuleRow,
): Promise<void> {
  await creditReward(
    admin,
    referral.id,
    referral.referrer_user_id,
    rule.referrer_reward_type,
    rule.referrer_reward_value,
  );

  if (rule.referred_reward_type && rule.referred_reward_value) {
    await creditReward(
      admin,
      referral.id,
      referral.referred_user_id,
      rule.referred_reward_type,
      rule.referred_reward_value,
    );
  }
}

async function creditReward(
  admin: Admin,
  referralId: string,
  userId: string,
  rewardType: string,
  value: number,
): Promise<void> {
  const db = admin as SupabaseClient<any>;

  await db.from("referral_reward_ledger").insert({
    referral_id: referralId,
    user_id: userId,
    reward_type: rewardType,
    reward_value: value,
  });

  switch (rewardType) {
    case "unlock_credit":
    case "cash_credit_kes": {
      const credit = rewardType === "unlock_credit" ? value * 50 : value;
      const { data: profile } = await admin
        .from("profiles")
        .select("referral_credit_kes")
        .eq("id", userId)
        .maybeSingle();
      const current = (profile as any)?.referral_credit_kes ?? 0;
      await admin
        .from("profiles")
        .update({ referral_credit_kes: current + credit } as any)
        .eq("id", userId);
      break;
    }
    case "listing_slot_bonus": {
      const { data: profile } = await admin
        .from("profiles")
        .select("bonus_listing_slots")
        .eq("id", userId)
        .maybeSingle();
      const current = profile?.bonus_listing_slots ?? 0;
      await admin
        .from("profiles")
        .update({ bonus_listing_slots: current + value })
        .eq("id", userId);
      break;
    }
    case "trial_extension_days": {
      // Extend trial_ends_at by N days
      const { data: profile } = await admin
        .from("profiles")
        .select("trial_ends_at")
        .eq("id", userId)
        .maybeSingle();
      const base = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : new Date();
      base.setDate(base.getDate() + value);
      await admin
        .from("profiles")
        .update({ trial_ends_at: base.toISOString() } as any)
        .eq("id", userId);
      break;
    }
    case "free_month_extension": {
      // Extend active subscription by N months
      const { data: sub } = await db
        .from("subscriptions")
        .select("id, next_billing_date")
        .eq("user_id", userId)
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (sub) {
        const d = new Date(sub.next_billing_date);
        d.setMonth(d.getMonth() + value);
        await db
          .from("subscriptions")
          .update({ next_billing_date: d.toISOString() })
          .eq("id", sub.id);
      }
      break;
    }
    case "subscription_discount_percent": {
      await db.from("pending_renewal_discounts").upsert(
        { user_id: userId, discount_percent: value },
        { onConflict: "user_id" },
      );
      break;
    }
  }
}

async function notifyReferralConverted(admin: Admin, referral: ReferralRow): Promise<void> {
  try {
    const { notifyUser } = await import("@/lib/notifications/notify-user");
    const { data: referred } = await admin
      .from("profiles")
      .select("full_name")
      .eq("id", referral.referred_user_id)
      .maybeSingle();
    const name = referred?.full_name || "Someone you referred";
    await notifyUser(admin, {
      userId: referral.referrer_user_id,
      type: "account",
      title: "Referral reward earned",
      body: `${name} completed their signup — your reward has been credited.`,
      href: "/referrals",
      entityType: "referral",
      entityId: referral.id,
    });
  } catch (err) {
    console.warn("[referrals] notify failed:", err);
  }
}
