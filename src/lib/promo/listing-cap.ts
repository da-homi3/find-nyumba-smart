import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { LandlordPlan } from "@/lib/revenue/types";
import { LISTING_LIMITS } from "@/lib/revenue/listing-limits";
import {
  getActiveLandlordPlan,
  hasPaidMarketplacePortalAccess,
} from "@/lib/revenue/subscription-store";

type Db = SupabaseClient<Database>;

type ListingCapProfile = {
  bonus_listing_slots: number | null;
  admin_listing_limit_override: number | null;
};

export async function getListingCapProfile(
  supabase: Db,
  userId: string,
): Promise<ListingCapProfile | null> {
  const { data } = await supabase
    .from("profiles")
    .select("bonus_listing_slots, admin_listing_limit_override")
    .eq("id", userId)
    .maybeSingle();
  return data ?? null;
}

export async function getBonusListingSlots(supabase: Db, userId: string): Promise<number> {
  const profile = await getListingCapProfile(supabase, userId);
  return profile?.bonus_listing_slots ?? 0;
}

export async function getAdminListingLimitOverride(
  supabase: Db,
  userId: string,
): Promise<number | null> {
  const profile = await getListingCapProfile(supabase, userId);
  return profile?.admin_listing_limit_override ?? null;
}

export function baseListingCap(plan: LandlordPlan): number {
  return LISTING_LIMITS[plan] ?? 0;
}

export function resolveListingCap(input: {
  plan: LandlordPlan;
  bonusSlots?: number;
  adminOverride?: number | null;
  loyaltyExtraSlots?: number;
}): number {
  if (input.adminOverride != null) {
    return Math.max(0, Math.min(9999, input.adminOverride));
  }
  const base = baseListingCap(input.plan);
  // Unpaid / free accounts cannot list — bonus slots only apply on a paid plan.
  if (base <= 0) return 0;
  if (base >= 9999) return base;
  return base + (input.bonusSlots ?? 0) + (input.loyaltyExtraSlots ?? 0);
}

export function listingCapReachedMessage(cap: number): string {
  if (cap <= 0) {
    return "Subscribe to a paid plan to list properties.";
  }
  return `This account has reached its listing limit of ${cap}. Upgrade the plan for more.`;
}

export async function getListingCap(supabase: Db, userId: string): Promise<number> {
  const { data: adminRole } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (adminRole) return 9999;

  const [plan, profile, paid] = await Promise.all([
    getActiveLandlordPlan(supabase, userId),
    getListingCapProfile(supabase, userId),
    hasPaidMarketplacePortalAccess(supabase, userId),
  ]);

  if (profile?.admin_listing_limit_override == null && !paid) {
    return 0;
  }

  let loyaltyExtraSlots = 0;
  try {
    const { getLoyaltyLevel } = await import("@/lib/loyalty/points");
    const { loyaltyExtraListings } = await import("@/lib/loyalty/benefits");
    const level = await getLoyaltyLevel(supabase, userId);
    loyaltyExtraSlots = loyaltyExtraListings(level);
  } catch (err) {
    console.warn("[listing-cap] loyalty lookup failed", err);
  }

  return resolveListingCap({
    plan: paid ? plan : "free",
    bonusSlots: profile?.bonus_listing_slots ?? 0,
    adminOverride: profile?.admin_listing_limit_override,
    loyaltyExtraSlots,
  });
}

export async function countActiveListings(supabase: Db, userId: string): Promise<number> {
  const { count, error } = await supabase
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", userId)
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}
