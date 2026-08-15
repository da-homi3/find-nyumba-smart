export const PLUS_PLAN = {
  monthlyKes: 700,
  quarterlyKes: 1800,
  quarterlyRegularKes: 2100,
  contactCreditsPerMonth: 10,
  features: [
    "10 contact credits every month (extra unlocks stay pay-as-you-go)",
    "NyumbaSearch AI — natural-language search, matching, and compare",
    "Financial planning tools (affordability, move-in, savings)",
    "In-app messaging with landlords and service providers",
    "Scam-risk scores on every property you view",
    "Unlimited saved homes and saved-search alerts",
    "Early access: new listings 24hrs before public",
  ],
};

export function getPlusPricing(plan = PLUS_PLAN) {
  const savingsKes = Math.max(0, plan.quarterlyRegularKes - plan.quarterlyKes);
  const effectiveMonthlyKes = Math.round(plan.quarterlyKes / 3);
  return {
    monthlyKes: plan.monthlyKes,
    quarterlyKes: plan.quarterlyKes,
    quarterlyRegularKes: plan.quarterlyRegularKes,
    savingsKes,
    effectiveMonthlyKes,
    contactCreditsPerMonth: plan.contactCreditsPerMonth,
    features: plan.features,
  };
}
