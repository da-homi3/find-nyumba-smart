/** Signup roles eligible for founding-member promo slots. */
export type PromoEligibleRole = "agency" | "manager" | "landlord";

export const PROMO_ELIGIBLE_ROLES = new Set<PromoEligibleRole>(["agency", "manager", "landlord"]);

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
