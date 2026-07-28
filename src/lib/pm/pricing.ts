import type { PmDb } from "@/lib/pm/access";

export type PmPricingTier = {
  id: string;
  tier_name: string;
  max_units: number;
  price_kes: number;
};

export const PM_FALLBACK_TIER = { tier: "pm-scale", priceKes: 9000 } as const;

/** Pure tier picker — unit tests cover this; DB path uses recommendedPmTier. */
export function pickPmTier(
  unitCount: number,
  tiers: PmPricingTier[],
): { tier: string; priceKes: number; tierName: string } {
  for (const tier of tiers) {
    if (tier.max_units === -1 || unitCount <= tier.max_units) {
      return { tier: tier.id, priceKes: tier.price_kes, tierName: tier.tier_name };
    }
  }
  return {
    tier: PM_FALLBACK_TIER.tier,
    priceKes: PM_FALLBACK_TIER.priceKes,
    tierName: "PM Scale",
  };
}

/** Recommend PM tier from current managed unit count for this account. */
export async function recommendedPmTier(
  admin: PmDb,
  userId: string,
): Promise<{ tier: string; priceKes: number; unitCount: number; tierName: string }> {
  const { data: props } = await admin
    .from("pm_properties")
    .select("id")
    .eq("owner_user_id", userId)
    .is("deleted_at", null);

  const propertyIds = (props ?? []).map((p: { id: string }) => p.id);
  let count = 0;
  if (propertyIds.length > 0) {
    const { count: unitCount } = await admin
      .from("pm_units")
      .select("id", { count: "exact", head: true })
      .in("property_id", propertyIds)
      .is("deleted_at", null);
    count = unitCount ?? 0;
  }

  const { data: tiers } = await admin
    .from("pm_pricing_tiers")
    .select("id, tier_name, max_units, price_kes")
    .order("price_kes", { ascending: true });

  const picked = pickPmTier(count, (tiers ?? []) as PmPricingTier[]);
  return { ...picked, unitCount: count };
}

export function isPmPlanId(plan: string): boolean {
  return plan === "pm-starter" || plan === "pm-growth" || plan === "pm-scale";
}
