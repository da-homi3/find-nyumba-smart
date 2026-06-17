import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { Property } from "@/lib/properties";
import { planRank } from "@/lib/revenue/entitlements";
import type { LandlordPlan, TenantPlan } from "@/lib/revenue/types";

type Db = SupabaseClient<Database>;

const LANDLORD_PLANS = new Set<LandlordPlan>([
  "free",
  "pro",
  "premium",
  "agency-starter",
  "agency-pro",
  "agency-enterprise",
]);

function isLandlordPlan(plan: string): plan is LandlordPlan {
  return LANDLORD_PLANS.has(plan as LandlordPlan);
}

export async function getActiveLandlordPlan(supabase: Db, userId: string): Promise<LandlordPlan> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, next_billing_date")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false });

  const now = Date.now();
  let best: LandlordPlan = "free";
  for (const row of data ?? []) {
    if (!isLandlordPlan(row.plan)) continue;
    if (new Date(row.next_billing_date).getTime() <= now) continue;
    if (planRank(row.plan) > planRank(best)) best = row.plan;
  }
  return best;
}

export async function getTenantPlusStatus(
  supabase: Db,
  userId: string,
): Promise<{ tenantPlan: TenantPlan; plusExpiresAt: string | null }> {
  const { data } = await supabase
    .from("subscriptions")
    .select("plan, status, next_billing_date")
    .eq("user_id", userId)
    .in("status", ["active", "trialing"])
    .eq("plan", "plus")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || new Date(data.next_billing_date).getTime() <= Date.now()) {
    return { tenantPlan: "free", plusExpiresAt: null };
  }
  return { tenantPlan: "plus", plusExpiresAt: data.next_billing_date };
}

export async function fetchActiveBoostMap(supabaseAdmin: Db): Promise<Map<string, string>> {
  const now = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("listing_boosts")
    .select("listing_id, end_date")
    .gte("end_date", now);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const existing = map.get(row.listing_id);
    if (!existing || new Date(row.end_date) > new Date(existing)) {
      map.set(row.listing_id, row.end_date);
    }
  }
  return map;
}

export async function fetchVerifiedAtMap(supabaseAdmin: Db): Promise<Map<string, string>> {
  const { data } = await supabaseAdmin
    .from("verification_requests")
    .select("listing_id, created_at")
    .eq("status", "complete")
    .not("listing_id", "is", null);

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    if (!row.listing_id) continue;
    map.set(row.listing_id, row.created_at);
  }
  return map;
}

export async function enrichPropertiesWithRevenue(
  supabaseAdmin: Db,
  properties: Property[],
): Promise<Property[]> {
  if (properties.length === 0) return properties;

  const [boostMap, verifiedMap] = await Promise.all([
    fetchActiveBoostMap(supabaseAdmin),
    fetchVerifiedAtMap(supabaseAdmin),
  ]);

  return properties.map((p) => ({
    ...p,
    featured_until: boostMap.get(p.id) ?? p.featured_until ?? null,
    boost_package: boostMap.has(p.id)
      ? (p.boost_package ?? "spotlight")
      : (p.boost_package ?? null),
    nyumba_verified_at: verifiedMap.get(p.id) ?? p.nyumba_verified_at ?? null,
  }));
}

export async function countActivePlusMembers(supabaseAdmin: Db): Promise<number> {
  const now = new Date().toISOString();
  const { count } = await supabaseAdmin
    .from("subscriptions")
    .select("id", { count: "exact", head: true })
    .eq("plan", "plus")
    .in("status", ["active", "trialing"])
    .gt("next_billing_date", now);
  return count ?? 0;
}
