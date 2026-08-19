import { getPlatformSetting } from "@/lib/revenue/platform-settings";
import { DEFAULT_RECOMMENDATION_WEIGHTS, HOW_RECOMMENDATIONS_WORK } from "@/lib/recommendations/config";
import {
  buildShelves,
  diversify,
  inferNeedsFromBehavior,
  isColdStart,
  mergeNeeds,
  moreLikeThis,
  scoreProperty,
} from "@/lib/recommendations/engine";
import { parseLocations } from "@/lib/recommendations/locations";
import { loadPriceDrops } from "@/lib/recommendations/price-history";
import type {
  BehaviorSignals,
  FeedbackAction,
  RecProperty,
  RecommendationFeed,
  RecommendationWeights,
  ProviderRecommendation,
  ScoredRecommendation,
  TenantNeeds,
} from "@/lib/recommendations/types";
import type { Property } from "@/lib/properties";
import type { LooseDb } from "@/lib/db/loose-client";

const CANDIDATE_COLUMNS =
  "id,title,property_type,neighborhood,rent_kes,bedrooms,bathrooms,amenities,images,is_verified,is_active,is_vacant,authenticity_score,available_from,created_at,updated_at,owner_id,organization_id,views";

const CARD_COLUMNS =
  "id,title,property_type,neighborhood,address,latitude,longitude,rent_kes,rent_kes_max,bedrooms,bathrooms,amenities,images,is_verified,is_active,is_vacant,authenticity_score,available_from,pricing_mode,price_period,views,created_at,updated_at,featured_until,boost_package,nyumba_verified_at,owner_id,organization_id";

function asText(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

function asIso(value: unknown, fallback: string): string {
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function asRecProperty(row: Record<string, unknown>): RecProperty {
  const nowIso = new Date().toISOString();
  const createdAt = asIso(row.created_at, nowIso);
  return {
    id: asText(row.id),
    title: asText(row.title, "Home"),
    neighborhood: asText(row.neighborhood),
    rentKes: Number(row.rent_kes) || 0,
    bedrooms: Number(row.bedrooms) || 0,
    bathrooms: Number(row.bathrooms) || 0,
    propertyType: asText(row.property_type),
    amenities: Array.isArray(row.amenities) ? row.amenities.map((item) => asText(item)) : [],
    isVerified: row.is_verified === true,
    isVacant: row.is_vacant !== false,
    authenticityScore: Number(row.authenticity_score) || 0,
    availableFrom: asText(row.available_from) || null,
    createdAt,
    updatedAt: asIso(row.updated_at, createdAt),
    ownerId: asText(row.owner_id) || null,
    organizationId: asText(row.organization_id) || null,
    images: Array.isArray(row.images) ? row.images.map((item) => asText(item)) : [],
    views: Number(row.views) || 0,
  };
}

export async function loadRecommendationWeights(): Promise<RecommendationWeights> {
  return getPlatformSetting("recommendation_weights", DEFAULT_RECOMMENDATION_WEIGHTS);
}

function greetingFor(name: string, now = new Date()): string {
  const hour = now.getHours();
  const first = name.split(/\s+/)[0] || "there";
  if (hour < 12) return `Good morning, ${first}`;
  if (hour < 17) return `Good afternoon, ${first}`;
  return `Good evening, ${first}`;
}

function afterReset(iso: string | null | undefined, resetAt: string | null): boolean {
  if (!resetAt || !iso) return true;
  const t = new Date(iso).getTime();
  const r = new Date(resetAt).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(r)) return true;
  return t >= r;
}

async function loadPrefs(admin: LooseDb, userId: string) {
  const extra = await admin
    .from("tenant_search_profiles")
    .select(
      "preferred_locations,budget_min,budget_max,bedrooms,property_type,move_in_date,recs_enabled,parking_required,recs_reset_at",
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!extra.error) return (extra.data ?? null) as Record<string, unknown> | null;
  const { data } = await admin
    .from("tenant_search_profiles")
    .select("preferred_locations,budget_min,budget_max,bedrooms,property_type,move_in_date")
    .eq("user_id", userId)
    .maybeSingle();
  return (data ?? null) as Record<string, unknown> | null;
}

async function loadHidden(admin: LooseDb, userId: string) {
  try {
    const { data } = await admin
      .from("recommendation_feedback")
      .select("property_id, owner_id, action")
      .eq("user_id", userId)
      .in("action", ["hide", "not_interested", "dont_recommend_provider"])
      .limit(200);
    const hiddenPropertyIds: string[] = [];
    const hiddenOwnerIds: string[] = [];
    for (const row of data ?? []) {
      const propertyId = asText(row.property_id);
      const ownerId = asText(row.owner_id);
      if (propertyId) hiddenPropertyIds.push(propertyId);
      if (ownerId && asText(row.action) === "dont_recommend_provider") {
        hiddenOwnerIds.push(ownerId);
      }
    }
    return { hiddenPropertyIds, hiddenOwnerIds };
  } catch {
    return { hiddenPropertyIds: [] as string[], hiddenOwnerIds: [] as string[] };
  }
}

export async function buildRecommendationFeed(input: {
  userId: string;
  plus: boolean;
  firstName: string;
  personalizationEnabled?: boolean;
  ownerScope?: string | null;
}): Promise<RecommendationFeed> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asLooseDb } = await import("@/lib/db/loose-client");
  const admin = asLooseDb(supabaseAdmin);
  const weights = await loadRecommendationWeights();

  const [prefs, hidden, savedRows, viewRows, searchRows, inquiryRows, listingRows] = await Promise.all([
    loadPrefs(admin, input.userId),
    loadHidden(admin, input.userId),
    supabaseAdmin
      .from("saved_properties")
      .select("property_id, created_at")
      .eq("user_id", input.userId)
      .limit(40),
    supabaseAdmin
      .from("property_views")
      .select("property_id, created_at")
      .eq("viewer_id", input.userId)
      .order("created_at", { ascending: false })
      .limit(40),
    supabaseAdmin
      .from("search_events")
      .select("neighborhood, created_at")
      .eq("user_id", input.userId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabaseAdmin
      .from("inquiries")
      .select("landlord_id, created_at")
      .eq("tenant_id", input.userId)
      .not("landlord_id", "is", null)
      .limit(30),
    (async () => {
      let query = supabaseAdmin
        .from("properties")
        .select(CANDIDATE_COLUMNS)
        .eq("is_active", true)
        .eq("is_vacant", true)
        .order("created_at", { ascending: false })
        .limit(weights.maxCandidates);
      if (input.ownerScope) query = query.eq("owner_id", input.ownerScope);
      return query;
    })(),
  ]);

  const resetAt = (prefs?.recs_reset_at as string | null) ?? null;
  const candidates = ((listingRows.data ?? []) as unknown as Record<string, unknown>[]).map(asRecProperty);
  const byId = new Map(candidates.map((p) => [p.id, p]));

  const savedIds = (savedRows.data ?? [])
    .filter((r) => afterReset(r.created_at, resetAt))
    .map((r) => r.property_id);
  const viewedIds = (viewRows.data ?? [])
    .filter((r) => afterReset(r.created_at, resetAt))
    .map((r) => r.property_id);
  const missing = [...new Set([...savedIds, ...viewedIds])].filter((id) => !byId.has(id));
  if (missing.length > 0) {
    const extra = await supabaseAdmin.from("properties").select(CANDIDATE_COLUMNS).in("id", missing);
    for (const row of (extra.data ?? []) as unknown as Record<string, unknown>[]) {
      const rec = asRecProperty(row);
      byId.set(rec.id, rec);
    }
  }

  const personalizationEnabled =
    input.personalizationEnabled !== false && prefs?.recs_enabled !== false;

  const explicit: TenantNeeds = {
    budgetMin: Number(prefs?.budget_min) || null,
    budgetMax: Number(prefs?.budget_max) || null,
    budgetStrict: false,
    locations: parseLocations(asText(prefs?.preferred_locations)),
    bedrooms: Number(prefs?.bedrooms) || null,
    propertyType: asText(prefs?.property_type).trim() || null,
    parkingRequired: prefs?.parking_required === true,
    moveInDate: asText(prefs?.move_in_date).trim() || null,
    amenities: [],
  };

  const priceDrops = input.plus
    ? await loadPriceDrops([...savedIds, ...viewedIds])
    : [];

  const behavior: BehaviorSignals = {
    viewed: viewedIds.map((id) => byId.get(id)).filter((p): p is RecProperty => Boolean(p)),
    saved: savedIds.map((id) => byId.get(id)).filter((p): p is RecProperty => Boolean(p)),
    searchedLocations: (searchRows.data ?? [])
      .filter((r) => afterReset(r.created_at, resetAt))
      .map((r) => asText(r.neighborhood).trim())
      .filter(Boolean),
    contactedOwnerIds: [
      ...new Set(
        (inquiryRows.data ?? [])
          .filter((r) => afterReset(r.created_at, resetAt))
          .map((r) => r.landlord_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ],
    hiddenPropertyIds: hidden.hiddenPropertyIds,
    hiddenOwnerIds: hidden.hiddenOwnerIds,
    priceDrops,
    personalizationEnabled,
    resetAt,
  };

  const needs = personalizationEnabled ? mergeNeeds(explicit, inferNeedsFromBehavior(behavior)) : explicit;

  const scored: ScoredRecommendation[] = [];
  for (const property of candidates) {
    const item = scoreProperty(property, needs, behavior, weights);
    if (item) scored.push(item);
  }
  const diversified = diversify(scored, byId, weights);
  const coldStart = isColdStart(needs, behavior);
  const shelves = coldStart
    ? []
    : buildShelves({
        scored: diversified,
        byId,
        needs,
        behavior,
        plus: input.plus,
        weights,
        ownerScope: input.ownerScope,
      });

  const providers =
    input.plus && !input.ownerScope ? await buildProviderRecs(admin, candidates, needs, weights) : [];

  const portfolioMatchCount = input.ownerScope
    ? scored.filter((item) => item.matchScore >= 70).length
    : null;
  const newMatchCount = shelves.find((s) => s.id === "new_in_your_areas" || s.id === "just_listed")?.items.length ?? 0;
  const exploreLocation = needs.locations[0] ?? null;

  return {
    greeting: greetingFor(input.firstName),
    firstName: input.firstName.split(/\s+/)[0] || "there",
    coldStart,
    plus: input.plus,
    personalizationEnabled,
    howItWorks: HOW_RECOMMENDATIONS_WORK,
    shelves,
    providers,
    portfolioMatchCount,
    newMatchCount,
    exploreLocation,
    ownerScope: input.ownerScope ?? null,
    expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

function matchesPreferredLocation(property: RecProperty, needs: TenantNeeds): boolean {
  if (needs.locations.length === 0) return true;
  return needs.locations.some((loc) => property.neighborhood.toLowerCase().includes(loc));
}

function scoreProviderGroup(
  ownerId: string,
  list: RecProperty[],
  needs: TenantNeeds,
): ProviderRecommendation | null {
  if (list.length < 3) return null;
  const inBudget = needs.budgetMax ? list.filter((p) => p.rentKes <= needs.budgetMax * 1.1) : list;
  if (inBudget.length === 0) return null;
  const inLoc = list.filter((p) => matchesPreferredLocation(p, needs));
  const areas = [...new Set(list.map((p) => p.neighborhood).filter(Boolean))].slice(0, 4);
  const score = Math.min(
    95,
    50 +
      Math.round((inBudget.length / Math.max(list.length, 1)) * 20) +
      Math.round((inLoc.length / Math.max(list.length, 1)) * 15) +
      (list.some((p) => p.isVerified) ? 8 : 0),
  );
  return {
    ownerId,
    name: "Verified provider",
    verified: list.some((p) => p.isVerified),
    matchScore: score,
    activeCount: list.length,
    matchCount: inBudget.filter((p) => matchesPreferredLocation(p, needs)).length,
    areas,
    reasons: [
      `${inBudget.length} properties within your budget`,
      inLoc.length > 0 ? `${inLoc.length} in your preferred locations` : "Active listings on NyumbaSearch",
      list.some((p) => p.bedrooms === needs.bedrooms) ? "Homes in your preferred size" : "Varied unit mix",
    ],
    specialties: areas.slice(0, 3),
  };
}

async function buildProviderRecs(
  admin: LooseDb,
  candidates: RecProperty[],
  needs: TenantNeeds,
  weights: RecommendationWeights,
): Promise<ProviderRecommendation[]> {
  const groups = new Map<string, RecProperty[]>();
  for (const p of candidates) {
    if (!p.ownerId) continue;
    const list = groups.get(p.ownerId) ?? [];
    list.push(p);
    groups.set(p.ownerId, list);
  }
  const out: ProviderRecommendation[] = [];
  for (const [ownerId, list] of groups) {
    if (out.length >= weights.maxPerShelf) break;
    const rec = scoreProviderGroup(ownerId, list, needs);
    if (rec) out.push(rec);
  }
  const ranked = out.toSorted((a, b) => b.matchScore - a.matchScore).slice(0, 3);
  const ids = ranked.map((p) => p.ownerId);
  if (ids.length === 0) return ranked;
  const { data: profiles } = await admin.from("profiles").select("id, full_name").in("id", ids);
  const nameById = new Map(
    (profiles ?? []).map((p) => [asText(p.id), asText(p.full_name).trim()]),
  );
  return ranked.map((p) => ({
    ...p,
    name: nameById.get(p.ownerId) || "Verified provider",
  }));
}

export type HydratedRecItem = ScoredRecommendation & { property: Property | null };
export type HydratedRecShelf = Omit<RecommendationFeed["shelves"][number], "items"> & {
  items: HydratedRecItem[];
};
export type HydratedRecommendationFeed = Omit<RecommendationFeed, "shelves"> & {
  shelves: HydratedRecShelf[];
};

export async function hydrateRecommendationFeed(
  feed: RecommendationFeed,
): Promise<HydratedRecommendationFeed> {
  const ids = [...new Set(feed.shelves.flatMap((s) => s.items.map((i) => i.propertyId)))];
  const byId = await loadPropertiesByIds(ids);
  return {
    ...feed,
    shelves: feed.shelves.map((shelf) => ({
      ...shelf,
      items: shelf.items.map((item) => ({
        ...item,
        property: byId.get(item.propertyId) ?? null,
      })),
    })),
  };
}

async function loadPropertiesByIds(ids: string[]): Promise<Map<string, Property>> {
  const map = new Map<string, Property>();
  if (ids.length === 0) return map;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { mapPropertyRows } = await import("@/lib/api/nyumba/nyumba-shared");
  const { data } = await supabaseAdmin.from("properties").select(CARD_COLUMNS).in("id", ids);
  for (const property of mapPropertyRows((data ?? []) as never)) {
    map.set(property.id, property);
  }
  return map;
}

export async function buildMoreLikeThis(input: {
  propertyId: string;
  userId: string | null;
  plus: boolean;
}): Promise<{ seed: RecProperty | null; items: HydratedRecItem[] }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asLooseDb } = await import("@/lib/db/loose-client");
  const weights = await loadRecommendationWeights();
  const { data: sourceRow } = await supabaseAdmin
    .from("properties")
    .select(CANDIDATE_COLUMNS)
    .eq("id", input.propertyId)
    .maybeSingle();
  if (!sourceRow) return { seed: null, items: [] };
  const source = asRecProperty(sourceRow as unknown as Record<string, unknown>);
  const { data: listingRows } = await supabaseAdmin
    .from("properties")
    .select(CANDIDATE_COLUMNS)
    .eq("is_active", true)
    .eq("is_vacant", true)
    .order("created_at", { ascending: false })
    .limit(weights.maxCandidates);
  const candidates = ((listingRows ?? []) as unknown as Record<string, unknown>[]).map(asRecProperty);
  const hidden = input.userId
    ? await loadHidden(asLooseDb(supabaseAdmin), input.userId)
    : { hiddenPropertyIds: [] as string[] };
  const scored = moreLikeThis(source, candidates, weights, hidden.hiddenPropertyIds);
  const byId = await loadPropertiesByIds(scored.map((s) => s.propertyId));
  return {
    seed: source,
    items: scored.map((item) => ({
      ...item,
      property: byId.get(item.propertyId) ?? null,
    })),
  };
}

export async function recordRecommendationFeedback(input: {
  userId: string;
  action: FeedbackAction;
  propertyId?: string | null;
  ownerId?: string | null;
}): Promise<{ saved: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asLooseDb } = await import("@/lib/db/loose-client");
  const { recordProductEventCore } = await import("@/lib/analytics/product-events");
  try {
    await asLooseDb(supabaseAdmin).from("recommendation_feedback").insert({
      user_id: input.userId,
      property_id: input.propertyId ?? null,
      owner_id: input.ownerId ?? null,
      action: input.action,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("[recommendations] feedback table:", err);
  }
  void recordProductEventCore(input.userId, "recommendation_feedback", {
    action: input.action,
    propertyId: input.propertyId ?? null,
  });
  return { saved: true };
}

export async function recordRecommendationEvent(input: {
  userId: string;
  eventName: string;
  propertyId?: string | null;
  shelfId?: string | null;
}): Promise<void> {
  const { recordProductEventCore } = await import("@/lib/analytics/product-events");
  void recordProductEventCore(input.userId, input.eventName, {
    propertyId: input.propertyId ?? null,
    shelfId: input.shelfId ?? null,
  });
}

export async function updateRecommendationPrefs(input: {
  userId: string;
  recsEnabled?: boolean;
  reset?: boolean;
}): Promise<{ saved: boolean }> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { asLooseDb } = await import("@/lib/db/loose-client");
  const payload: Record<string, unknown> = {
    user_id: input.userId,
    updated_at: new Date().toISOString(),
  };
  if (input.recsEnabled !== undefined) payload.recs_enabled = input.recsEnabled;
  if (input.reset) payload.recs_reset_at = new Date().toISOString();
  const { error } = await asLooseDb(supabaseAdmin)
    .from("tenant_search_profiles")
    .upsert(payload, { onConflict: "user_id" });
  if (error) {
    console.warn("[recommendations] prefs columns:", error.message);
  }
  return { saved: true };
}

export function attachProperties(
  feed: RecommendationFeed,
  properties: Property[],
): RecommendationFeed & { propertyById: Record<string, Property> } {
  const propertyById: Record<string, Property> = {};
  for (const p of properties) propertyById[p.id] = p;
  return { ...feed, propertyById };
}

