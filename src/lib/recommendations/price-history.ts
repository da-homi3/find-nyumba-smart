import type { PriceDropSignal } from "@/lib/recommendations/types";

export async function recordPropertyPriceChange(input: {
  propertyId: string;
  previousRent: number;
  newRent: number;
  title?: string;
  neighborhood?: string;
  bedrooms?: number;
}): Promise<void> {
  if (!Number.isFinite(input.previousRent) || !Number.isFinite(input.newRent)) return;
  if (input.newRent >= input.previousRent) return;
  const drop = input.previousRent - input.newRent;
  if (drop < 500) return;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asLooseDb } = await import("@/lib/db/loose-client");
  const { recordProductEventCore } = await import("@/lib/analytics/product-events");
  try {
    await asLooseDb(supabaseAdmin).from("property_price_events").insert({
      property_id: input.propertyId,
      previous_rent: input.previousRent,
      new_rent: input.newRent,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[recommendations] price events table:", err);
  }
  void recordProductEventCore(null, "property_price_change", {
    propertyId: input.propertyId,
    previousRent: input.previousRent,
    newRent: input.newRent,
  });
  void notifyPriceDropWatchers(input);
}

export async function loadPriceDrops(propertyIds: string[]): Promise<PriceDropSignal[]> {
  const unique = [...new Set(propertyIds)].filter(Boolean).slice(0, 80);
  if (unique.length === 0) return [];
  const since = new Date(Date.now() - 21 * 24 * 60 * 60 * 1000).toISOString();
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { asLooseDb } = await import("@/lib/db/loose-client");
    const { data, error } = await asLooseDb(supabaseAdmin)
      .from("property_price_events")
      .select("property_id, previous_rent, new_rent, created_at")
      .in("property_id", unique)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error || !data?.length) return [];
    const seen = new Set<string>();
    const out: PriceDropSignal[] = [];
    for (const row of data) {
      const id = typeof row.property_id === "string" ? row.property_id : "";
      if (!id || seen.has(id)) continue;
      const previousRent = Number(row.previous_rent) || 0;
      const newRent = Number(row.new_rent) || 0;
      if (newRent <= 0 || previousRent <= newRent) continue;
      seen.add(id);
      out.push({ propertyId: id, previousRent, newRent });
    }
    return out;
  } catch {
    return [];
  }
}

async function notifyPriceDropWatchers(input: {
  propertyId: string;
  previousRent: number;
  newRent: number;
  title?: string;
  neighborhood?: string;
}): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: saved } = await supabaseAdmin
    .from("saved_properties")
    .select("user_id")
    .eq("property_id", input.propertyId)
    .limit(40);
  if (!saved?.length) return;
  const { getTenantPlusStatus } = await import("@/lib/revenue/subscription-store");
  const { notifyUser } = await import("@/lib/notifications/notify-user");
  const drop = input.previousRent - input.newRent;
  for (const row of saved) {
    const plus = await getTenantPlusStatus(supabaseAdmin, row.user_id);
    if (plus.tenantPlan !== "plus") continue;
    await notifyUser(supabaseAdmin, {
      userId: row.user_id,
      type: "listing_match",
      title: "A property you saved dropped in price.",
      body: `${input.neighborhood ?? "Listing"} · was KES ${input.previousRent.toLocaleString()} · now KES ${input.newRent.toLocaleString()} (−${drop.toLocaleString()})`,
      href: `/tenant/property/${input.propertyId}`,
      entityType: "property",
      entityId: input.propertyId,
      metadata: { kind: "price_drop", previousRent: input.previousRent, newRent: input.newRent },
    });
  }
}
