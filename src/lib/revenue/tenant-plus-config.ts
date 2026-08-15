import { PLUS_PLAN } from "@/lib/revenue/plus-plan";

/**
 * Commercial Tenant Plus benefits. Change here (or later via admin settings)
 * without rewriting unlock/AI/finance cores.
 */
export type ContactCreditBand = {
  maxFeeKes: number;
  credits: number;
};

export const TENANT_PLUS_FEATURE_FLAGS = {
  tenantPlusEnabled: true,
  aiEnabled: true,
  financialServicesEnabled: true,
  contactCreditsEnabled: true,
  premiumAlertsEnabled: true,
  tenantVerificationEnabled: true,
} as const;

export const TENANT_PLUS_CONFIG = {
  monthlyKes: PLUS_PLAN.monthlyKes,
  quarterlyKes: PLUS_PLAN.quarterlyKes,
  contactCreditsPerMonth: PLUS_PLAN.contactCreditsPerMonth,
  freeSavedPropertyLimit: 10,
  freeCompareLimit: 2,
  freeSavedSearchAlertLimit: 1,
  plusCompareLimit: 8,
  aiRequestsPerMinute: 20,
  creditBands: [
    { maxFeeKes: 100, credits: 1 },
    { maxFeeKes: 200, credits: 2 },
    { maxFeeKes: 300, credits: 3 },
    { maxFeeKes: 400, credits: 4 },
    { maxFeeKes: 500, credits: 5 },
  ] satisfies ContactCreditBand[],
  flags: TENANT_PLUS_FEATURE_FLAGS,
};

export function contactCreditsForFee(
  feeKes: number,
  bands: readonly ContactCreditBand[] = TENANT_PLUS_CONFIG.creditBands,
): number {
  const fee = Number.isFinite(feeKes) ? Math.max(0, feeKes) : 0;
  const sorted = [...bands].sort((a, b) => a.maxFeeKes - b.maxFeeKes);
  for (const band of sorted) {
    if (fee <= band.maxFeeKes) return band.credits;
  }
  return sorted.at(-1)?.credits ?? 1;
}

export function plusCreditsForBillingCycle(cycle: "monthly" | "quarterly"): number {
  const monthly = TENANT_PLUS_CONFIG.contactCreditsPerMonth;
  return cycle === "quarterly" ? monthly * 3 : monthly;
}

export function maxSavedProperties(isPlus: boolean): number {
  if (isPlus) return Number.POSITIVE_INFINITY;
  return TENANT_PLUS_CONFIG.freeSavedPropertyLimit;
}

export function maxComparedProperties(isPlus: boolean): number {
  return isPlus ? TENANT_PLUS_CONFIG.plusCompareLimit : TENANT_PLUS_CONFIG.freeCompareLimit;
}

export function maxSavedSearchAlerts(isPlus: boolean): number {
  if (isPlus) return Number.POSITIVE_INFINITY;
  return TENANT_PLUS_CONFIG.freeSavedSearchAlertLimit;
}
