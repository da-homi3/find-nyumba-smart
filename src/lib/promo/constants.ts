/** Signup roles eligible for founding-member promo slots. */
export type PromoEligibleRole = "agency" | "manager" | "landlord";

export const PROMO_ELIGIBLE_ROLES = new Set<PromoEligibleRole>(["agency", "manager", "landlord"]);

/** 20% off marketplace subscriptions for early / founding partners. */
export const EARLY_PARTNER_SUBSCRIPTION_DISCOUNT = 0.2;

export const PROMO_LABELS: Record<
  PromoEligibleRole,
  { maxSlots: number; bonusListings: number; label: string; campaignId: string }
> = {
  agency: {
    maxSlots: 25,
    bonusListings: 10,
    label: "Founding Agency",
    campaignId: "promo-agency",
  },
  manager: {
    maxSlots: 25,
    bonusListings: 10,
    label: "Founding Property Manager",
    campaignId: "promo-pm",
  },
  landlord: {
    maxSlots: 15,
    bonusListings: 5,
    label: "Founding Landlord",
    campaignId: "promo-landlord",
  },
};

export function campaignIdForRole(role: PromoEligibleRole): string {
  return PROMO_LABELS[role].campaignId;
}

export function isPromoEligibleRole(role: string): role is PromoEligibleRole {
  return PROMO_ELIGIBLE_ROLES.has(role as PromoEligibleRole);
}

/** Pending or confirmed founding members count as early partners. */
export function isEarlyPartnerStatus(status: string | null | undefined): boolean {
  return status === "pending" || status === "confirmed";
}

export function applyEarlyPartnerDiscount(amountKes: number, eligible: boolean): number {
  if (!eligible || !Number.isFinite(amountKes) || amountKes <= 0) return amountKes;
  return Math.max(1, Math.round(amountKes * (1 - EARLY_PARTNER_SUBSCRIPTION_DISCOUNT)));
}
