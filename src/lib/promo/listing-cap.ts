import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { LandlordPlan } from "@/lib/revenue/types";
import { LISTING_LIMITS } from "@/lib/revenue/listing-limits";
import { getActiveLandlordPlan } from "@/lib/revenue/subscription-store";

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
  return LISTING_LIMITS[plan] ?? 1;
}

export function resolveListingCap(input: {
  plan: LandlordPlan;
  bonusSlots?: number;
  adminOverride?: number | null;
}): number {
  if (input.adminOverride != null) {
    return Math.max(0, Math.min(9999, input.adminOverride));
  }
  const base = baseListingCap(input.plan);
  if (base >= 9999) return base;
  return base + (input.bonusSlots ?? 0);
}

export async function getListingCap(supabase: Db, userId: string): Promise<number> {
  const [plan, profile] = await Promise.all([
    getActiveLandlordPlan(supabase, userId),
    getListingCapProfile(supabase, userId),
  ]);
  return resolveListingCap({
    plan,
    bonusSlots: profile?.bonus_listing_slots ?? 0,
    adminOverride: profile?.admin_listing_limit_override,
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
