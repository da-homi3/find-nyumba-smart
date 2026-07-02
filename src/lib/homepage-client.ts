import type {
  FeaturedAgency,
  FeaturedTestimonial,
  PropertyIntelligenceStats,
} from "@/lib/api/homepage-shared";

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export function fetchFeaturedTestimonialsApi(): Promise<FeaturedTestimonial[]> {
  return fetchJson<FeaturedTestimonial[]>("/api/testimonials");
}

export function fetchIntelligenceStatsApi(): Promise<PropertyIntelligenceStats> {
  return fetchJson<PropertyIntelligenceStats>("/api/stats/intelligence");
}

export function fetchFeaturedAgenciesApi(): Promise<FeaturedAgency[]> {
  return fetchJson<FeaturedAgency[]>("/api/agencies/featured");
}
