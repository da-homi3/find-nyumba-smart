import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getAuthContext } from "@/lib/api/server-context";
import { publicTierLabelFromScore } from "@/lib/reputation/badge";
import { getReputationScore } from "@/lib/reputation/calculate";
import { getLoyaltySummary } from "@/lib/loyalty/points";
import { applyLoyaltyDiscount } from "@/lib/loyalty/benefits";
import { boostPrice } from "@/lib/revenue/plans";
import type { BoostPackage } from "@/lib/revenue/types";

export const getMyTrustRewards = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [score, loyalty] = await Promise.all([
      getReputationScore(supabaseAdmin, userId),
      getLoyaltySummary(supabaseAdmin, userId),
    ]);
    return {
      score,
      tierLabel: publicTierLabelFromScore(score),
      ...loyalty,
    };
  });

/** Public: tier labels only — never scores or factors. */
export const getPublicReputationTiers = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      userIds: z.array(z.string().uuid()).max(50),
    }),
  )
  .handler(async ({ data }) => {
    const ids = [...new Set(data.userIds)].slice(0, 50);
    if (ids.length === 0) return [] as Array<{ userId: string; tierLabel: string | null }>;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("reputation_scores")
      .select("user_id, score")
      .in("user_id", ids);

    const byId = new Map((rows ?? []).map((r) => [r.user_id, r.score]));
    return ids.map((userId) => ({
      userId,
      tierLabel: publicTierLabelFromScore(byId.get(userId) ?? 50),
    }));
  });

export const getBoostPriceForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      packageId: z.enum(["spotlight", "homepage", "campaign"]),
    }),
  )
  .handler(async ({ context, data }) => {
    const { userId } = getAuthContext(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getLoyaltyLevel } = await import("@/lib/loyalty/points");
    const level = await getLoyaltyLevel(supabaseAdmin, userId);
    const base = boostPrice(data.packageId as BoostPackage);
    const amountKes = applyLoyaltyDiscount(base, level);
    return { baseKes: base, amountKes, level };
  });
