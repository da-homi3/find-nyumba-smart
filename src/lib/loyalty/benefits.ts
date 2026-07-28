export type LoyaltyLevel = "bronze" | "silver" | "gold" | "platinum" | "diamond";

export const LEVEL_THRESHOLDS: Record<LoyaltyLevel, number> = {
  bronze: 0,
  silver: 200,
  gold: 600,
  platinum: 1500,
  diamond: 4000,
};

export const LEVEL_BENEFITS: Record<
  LoyaltyLevel,
  { boostDiscount: number; extraFreeListing: number; prioritySupport: boolean }
> = {
  bronze: { boostDiscount: 0, extraFreeListing: 0, prioritySupport: false },
  silver: { boostDiscount: 0.1, extraFreeListing: 0, prioritySupport: false },
  gold: { boostDiscount: 0.2, extraFreeListing: 1, prioritySupport: false },
  platinum: { boostDiscount: 0.3, extraFreeListing: 2, prioritySupport: true },
  diamond: { boostDiscount: 0.4, extraFreeListing: 5, prioritySupport: true },
};

const LOYALTY_LEVELS = new Set<string>(Object.keys(LEVEL_THRESHOLDS));

export function asLoyaltyLevel(level: string): LoyaltyLevel {
  return LOYALTY_LEVELS.has(level) ? (level as LoyaltyLevel) : "bronze";
}

export function resolveLoyaltyLevel(totalPoints: number): LoyaltyLevel {
  const ordered = (Object.entries(LEVEL_THRESHOLDS) as Array<[LoyaltyLevel, number]>).sort(
    (a, b) => b[1] - a[1],
  );
  for (const [level, min] of ordered) {
    if (totalPoints >= min) return level;
  }
  return "bronze";
}

export function applyLoyaltyDiscount(basePrice: number, level: LoyaltyLevel): number {
  const discount = LEVEL_BENEFITS[level]?.boostDiscount ?? 0;
  return Math.round(basePrice * (1 - discount));
}

export function loyaltyExtraListings(level: LoyaltyLevel): number {
  return LEVEL_BENEFITS[level]?.extraFreeListing ?? 0;
}
