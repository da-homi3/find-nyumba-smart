import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminClient, authContext } from "@/lib/api/nyumba/nyumba-shared";

export const getMyReferralInfo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = authContext(context);
    const admin = await adminClient();
    const db = admin as any;

    const { ensureReferralCode } = await import("@/lib/referrals/generate-code");
    const referralCode = await ensureReferralCode(admin, userId);

    const { data: referrals } = await db
      .from("referrals")
      .select("id, referred_user_id, referrer_role_at_referral, referred_role_at_referral, status, converted_at, created_at")
      .eq("referrer_user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    const rows = referrals ?? [];
    const referredUserIds = rows.map((r: any) => r.referred_user_id);
    let nameMap: Record<string, string> = {};
    if (referredUserIds.length > 0) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id, full_name")
        .in("id", referredUserIds);
      for (const p of profiles ?? []) {
        nameMap[p.id] = p.full_name ?? "User";
      }
    }

    const pendingCount = rows.filter((r: any) => r.status === "pending").length;
    const convertedCount = rows.filter((r: any) => r.status === "converted").length;

    const { data: rewards } = await db
      .from("referral_reward_ledger")
      .select("reward_type, reward_value")
      .eq("user_id", userId);

    const rewardSummary: Record<string, number> = {};
    for (const r of rewards ?? []) {
      rewardSummary[r.reward_type] = (rewardSummary[r.reward_type] ?? 0) + r.reward_value;
    }

    return {
      referralCode,
      pendingCount,
      convertedCount,
      totalRewardsSummary: formatRewardSummary(rewardSummary),
      referrals: rows.map((r: any) => ({
        id: r.id,
        referredName: nameMap[r.referred_user_id] ?? "User",
        referredRole: r.referred_role_at_referral,
        status: r.status,
        convertedAt: r.converted_at,
        createdAt: r.created_at,
      })),
    };
  });

function formatRewardSummary(summary: Record<string, number>): string {
  const parts: string[] = [];
  if (summary.unlock_credit) parts.push(`${summary.unlock_credit} unlock credits`);
  if (summary.listing_slot_bonus) parts.push(`${summary.listing_slot_bonus} bonus slots`);
  if (summary.cash_credit_kes) parts.push(`KES ${summary.cash_credit_kes}`);
  if (summary.free_month_extension) parts.push(`${summary.free_month_extension} free months`);
  if (summary.subscription_discount_percent) parts.push(`${summary.subscription_discount_percent}% discount`);
  if (summary.trial_extension_days) parts.push(`${summary.trial_extension_days} trial days`);
  return parts.join(", ") || "—";
}

export const resolveReferralCode = createServerFn({ method: "POST" })
  .inputValidator(z.object({ code: z.string().trim().min(1) }))
  .handler(async ({ data }) => {
    const admin = await adminClient();
    const { data: profile } = await admin
      .from("profiles")
      .select("id, full_name, referral_code" as any)
      .eq("referral_code" as any, data.code.toUpperCase())
      .maybeSingle();

    if (!profile) return { valid: false as const };
    return {
      valid: true as const,
      referrerName: (profile as any).full_name ?? "NyumbaSearch user",
    };
  });
