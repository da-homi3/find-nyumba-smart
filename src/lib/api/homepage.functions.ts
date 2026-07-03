import { createServerFn } from "@tanstack/react-start";
import { createPublicClient } from "@/lib/api/public-client";
import {
  FALLBACK_INTELLIGENCE,
  FALLBACK_TESTIMONIALS,
  formatTestimonialRole,
  maskName,
  type FeaturedAgency,
  type FeaturedTestimonial,
  type PropertyIntelligenceStats,
} from "@/lib/api/homepage-shared";

function hasBorehole(amenities: string[] | null | undefined): boolean {
  return (amenities ?? []).some((a) => /borehole|water tank|rainwater|backup water/i.test(a));
}

function hasFibre(amenities: string[] | null | undefined): boolean {
  return (amenities ?? []).some((a) => /fibre|fiber|wifi|internet|faiba|zuku/i.test(a));
}

export async function loadFeaturedTestimonials(): Promise<FeaturedTestimonial[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: rows, error } = await supabaseAdmin
    .from("property_reviews")
    .select("comment, rating_overall, reviewer_id, property_id, properties(neighborhood, owner_id)")
    .not("comment", "is", null)
    .gte("rating_overall", 4)
    .order("created_at", { ascending: false })
    .limit(12);

  if (error) {
    console.error("loadFeaturedTestimonials:", error.message);
    return FALLBACK_TESTIMONIALS;
  }

  const reviewerIds = [...new Set((rows ?? []).map((r) => r.reviewer_id))];
  const { data: profiles } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .in("id", reviewerIds.length ? reviewerIds : ["00000000-0000-0000-0000-000000000000"]);

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.full_name]));

  const items: FeaturedTestimonial[] = [];
  for (const row of rows ?? []) {
    const comment = row.comment?.trim();
    if (!comment || comment.length < 24) continue;

    const property = row.properties as {
      neighborhood: string;
      owner_id: string | null;
    } | null;
    const isLandlord = Boolean(property?.owner_id && property.owner_id === row.reviewer_id);

    items.push({
      name: maskName(nameById.get(row.reviewer_id)),
      roleLabel: formatTestimonialRole(property?.neighborhood, isLandlord),
      body: comment.length > 220 ? `${comment.slice(0, 217)}…` : comment,
      rating: row.rating_overall,
    });
    if (items.length >= 6) break;
  }

  return items.length > 0 ? items : FALLBACK_TESTIMONIALS;
}

export async function loadPropertyIntelligenceStats(): Promise<PropertyIntelligenceStats> {
  const supabase = createPublicClient();
  const { data: rows, error } = await supabase
    .from("properties")
    .select("neighborhood, amenities, is_verified, authenticity_score")
    .eq("is_active", true)
    .limit(2000);

  if (error || !rows?.length) {
    console.error("loadPropertyIntelligenceStats:", error?.message);
    return FALLBACK_INTELLIGENCE;
  }

  const kilimani = rows.filter((r) => r.neighborhood === "Kilimani");
  const westlands = rows.filter((r) => r.neighborhood === "Westlands");

  const kilimaniBorehole =
    kilimani.length > 0
      ? Math.round(
          (kilimani.filter((r) => hasBorehole(r.amenities)).length / kilimani.length) * 100,
        )
      : null;

  const westlandsFibre =
    westlands.length > 0
      ? Math.round((westlands.filter((r) => hasFibre(r.amenities)).length / westlands.length) * 100)
      : null;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: verifiedProps } = await supabaseAdmin
    .from("properties")
    .select("id")
    .eq("is_active", true)
    .eq("is_verified", true)
    .gte("authenticity_score", 75)
    .limit(500);

  const verifiedIds = (verifiedProps ?? []).map((p) => p.id);
  let avgSecurity: number | null = null;
  if (verifiedIds.length > 0) {
    const { data: securityRows } = await supabaseAdmin
      .from("property_reviews")
      .select("security_rating")
      .in("property_id", verifiedIds)
      .not("security_rating", "is", null)
      .limit(500);

    const ratings = (securityRows ?? [])
      .map((r) => r.security_rating)
      .filter((n): n is number => n != null);
    if (ratings.length > 0) {
      avgSecurity = Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10;
    }
  }

  return {
    kilimaniBoreholePercent: kilimaniBorehole ?? FALLBACK_INTELLIGENCE.kilimaniBoreholePercent,
    westlandsFibrePercent: westlandsFibre ?? FALLBACK_INTELLIGENCE.westlandsFibrePercent,
    avgSecurityScore: avgSecurity ?? FALLBACK_INTELLIGENCE.avgSecurityScore,
    kilimaniSampleSize: kilimani.length,
    westlandsSampleSize: westlands.length,
  };
}

export async function loadFeaturedAgencies(): Promise<FeaturedAgency[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: orgs, error } = await supabaseAdmin
    .from("organizations")
    .select("id, name, logo_url, slug")
    .eq("type", "agency")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("loadFeaturedAgencies:", error.message);
    return [];
  }
  if (!orgs?.length) return [];

  const ids = orgs.map((o) => o.id);
  const { data: propertyRows } = await supabaseAdmin
    .from("properties")
    .select("organization_id")
    .eq("is_active", true)
    .in("organization_id", ids);

  const counts = new Map<string, number>();
  for (const row of propertyRows ?? []) {
    if (!row.organization_id) continue;
    counts.set(row.organization_id, (counts.get(row.organization_id) ?? 0) + 1);
  }

  return orgs
    .map((org) => ({
      id: org.id,
      name: org.name,
      logoUrl: org.logo_url,
      slug: org.slug,
      listingCount: counts.get(org.id) ?? 0,
    }))
    .sort((a, b) => b.listingCount - a.listingCount || a.name.localeCompare(b.name))
    .slice(0, 8);
}

export const getFeaturedTestimonials = createServerFn({ method: "GET" }).handler(
  async (): Promise<FeaturedTestimonial[]> => loadFeaturedTestimonials(),
);

export const getPropertyIntelligenceStats = createServerFn({ method: "GET" }).handler(
  async (): Promise<PropertyIntelligenceStats> => loadPropertyIntelligenceStats(),
);

export const getFeaturedAgencies = createServerFn({ method: "GET" }).handler(
  async (): Promise<FeaturedAgency[]> => loadFeaturedAgencies(),
);
