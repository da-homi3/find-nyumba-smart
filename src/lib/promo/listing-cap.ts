import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { LandlordPlan } from "@/lib/revenue/types";
import { LISTING_LIMITS } from "@/lib/revenue/plans";
import { getActiveLandlordPlan } from "@/lib/revenue/subscription-store";

type Db = SupabaseClient<Database>;

export async function getBonusListingSlots(supabase: Db, userId: string): Promise<number> {
  const { data } = await supabase
    .from("profiles")
    .select("bonus_listing_slots")
    .eq("id", userId)
    .maybeSingle();
  return data?.bonus_listing_slots ?? 0;
}

export function baseListingCap(plan: LandlordPlan): number {
  return LISTING_LIMITS[plan] ?? 1;
}

export async function getListingCap(supabase: Db, userId: string): Promise<number> {
  const [plan, bonus] = await Promise.all([
    getActiveLandlordPlan(supabase, userId),
    getBonusListingSlots(supabase, userId),
  ]);
  const base = baseListingCap(plan);
  if (base >= 9999) return base;
  return base + bonus;
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
