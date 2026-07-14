import type { LandlordPlan } from "@/lib/revenue/types";

export const LISTING_LIMITS: Record<LandlordPlan, number> = {
  free: 9,
  pro: 10,
  premium: 30,
  "manager-solo": 25,
  "manager-team": 100,
  "manager-enterprise": 9999,
  "agency-starter": 20,
  "agency-pro": 100,
  "agency-enterprise": 9999,
};

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
