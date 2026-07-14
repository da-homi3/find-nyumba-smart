import type { LandlordPlan, TenantPlan } from "@/lib/revenue/types";
import { LISTING_LIMITS } from "@/lib/revenue/plan-limits";

export type PortalSubscriptionStatus = "active" | "trialing" | "past_due" | "none";

export type UserEntitlements = {
  landlordPlan: LandlordPlan;
  tenantPlan: TenantPlan;
  plusExpiresAt: string | null;
  listingLimit: number;
  bonusListingSlots?: number;
  trialUnlocksRemaining?: number;
  trialEndsAt?: string | null;
  trialActive?: boolean;
  monthlyUnlockSpend?: number;
  portalSubscriptionStatus?: PortalSubscriptionStatus;
  portalTrialEndsAt?: string | null;
  leadPackBalance?: number;
  canViewLeadContacts?: boolean;
};

export const DEFAULT_ENTITLEMENTS: UserEntitlements = {
  landlordPlan: "free",
  tenantPlan: "free",
  plusExpiresAt: null,
  listingLimit: LISTING_LIMITS.free,
  trialUnlocksRemaining: 0,
  trialEndsAt: null,
  trialActive: false,
  monthlyUnlockSpend: 0,
  portalSubscriptionStatus: "none",
  portalTrialEndsAt: null,
  leadPackBalance: 0,
  canViewLeadContacts: false,
};

export function isPlusMember(entitlements: UserEntitlements): boolean {
  if (entitlements.tenantPlan === "plus") {
    if (!entitlements.plusExpiresAt) return true;
    return new Date(entitlements.plusExpiresAt) > new Date();
  }
  return false;
}

export type LeadContactAccessInput = {
  landlordPlan: LandlordPlan;
  subscriptionStatus: PortalSubscriptionStatus;
  leadPackBalance: number;
};

export function canViewLeadContactDetails(input: LeadContactAccessInput): boolean {
  if (input.leadPackBalance > 0) return true;
  return input.subscriptionStatus === "active" && input.landlordPlan !== "free";
}

/** @deprecated Use canViewLeadContactDetails for portal lead gating. */
export function canViewLeadDetails(plan: LandlordPlan): boolean {
  return plan !== "free";
}

export function canCreateListing(plan: LandlordPlan, currentCount: number): boolean {
  return currentCount < LISTING_LIMITS[plan];
}

export function isListingEarlyAccess(listingCreatedAt: string, plus: boolean): boolean {
  if (plus) return false;
  const ageMs = Date.now() - new Date(listingCreatedAt).getTime();
  return ageMs < 24 * 60 * 60 * 1000;
}

export function maxSavedSearchAlerts(plan: TenantPlan): number {
  return plan === "plus" ? 999 : 1;
}

export function planRank(plan: LandlordPlan): number {
  const order: LandlordPlan[] = [
    "free",
    "pro",
    "premium",
    "manager-solo",
    "manager-team",
    "manager-enterprise",
    "agency-starter",
    "agency-pro",
    "agency-enterprise",
  ];
  return order.indexOf(plan);
}
