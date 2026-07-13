import type { Property, PropertySearchFilters } from "@/lib/properties";
import { listingPlaceholderUrl } from "@/lib/property-images";

const IMG = (seed: number) => listingPlaceholderUrl(seed);

const now = new Date().toISOString();

function base(
  id: string,
  partial: Omit<Property, "id" | "created_at" | "updated_at" | "views">,
): Property {
  return {
    id,
    views: 120 + (id.codePointAt(id.length - 1) ?? 0),
    created_at: now,
    updated_at: now,
    ...partial,
  };
}

/** Demo listings used when Supabase returns no rows or the query fails. */
export const MOCK_PROPERTIES: Property[] = [
  base("a1000001-0001-4000-8000-000000000001", {
    owner_id: "b1000001-0001-4000-8000-000000000001",
    title: "Bright 2BR near Yaya Centre",
    property_type: "two_bedroom",
    neighborhood: "Kilimani",
    address: "Argwings Kodhek Rd",
    latitude: -1.2924,
    longitude: 36.7821,
    rent_kes: 42000,
    deposit_kes: 84000,
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 85,
    description: "Spacious 2-bedroom with borehole backup and 24/7 security. Fibre-ready building.",
    amenities: ["Parking", "Borehole", "Fibre", "Balcony"],
    images: [IMG(1), IMG(2)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 88,
    health_score: 82,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000002", {
    owner_id: "b1000001-0001-4000-8000-000000000002",
    title: "Modern studio — Westlands Square",
    property_type: "studio",
    neighborhood: "Westlands",
    address: "Ring Rd Parklands",
    latitude: -1.2678,
    longitude: 36.8075,
    rent_kes: 32000,
    deposit_kes: 64000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 42,
    description: "Compact studio ideal for young professionals. Zuku fibre installed.",
    amenities: ["Fibre", "Lift", "Security"],
    images: [IMG(3)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 76,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000003", {
    owner_id: "b1000001-0001-4000-8000-000000000003",
    title: "Affordable bedsitter — Kasarani Mwiki",
    property_type: "bedsitter",
    neighborhood: "Kasarani",
    address: "Mwiki Rd",
    latitude: -1.2245,
    longitude: 36.8998,
    rent_kes: 14000,
    deposit_kes: 28000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 22,
    description: "Clean bedsitter with own bathroom. Water available mornings and evenings.",
    amenities: ["Water tank"],
    images: [IMG(4)],
    video_url: null,
    is_verified: false,
    is_active: true,
    is_vacant: true,
    authenticity_score: 62,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000004", {
    owner_id: "b1000001-0001-4000-8000-000000000004",
    title: "Family 3BR — South B Mugoya",
    property_type: "three_bedroom",
    neighborhood: "South B",
    address: "Mugoya Estate",
    latitude: -1.3132,
    longitude: 36.8456,
    rent_kes: 35000,
    deposit_kes: 105000,
    bedrooms: 3,
    bathrooms: 2,
    area_sqm: 110,
    description: "Ground-floor maisonette with small garden. Near matatu stage to CBD.",
    amenities: ["Parking", "Garden", "Borehole"],
    images: [IMG(5), IMG(6)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 84,
    available_from: now,
  }),
];

export function getMockProperty(id: string): Property | null {
  return MOCK_PROPERTIES.find((p) => p.id === id) ?? null;
}

/** True when the listing is demo-only (not backed by a live Supabase row). */
export function isDemoListingId(id: string): boolean {
  return getMockProperty(id) != null;
}

/** Demo listings: on in dev by default; off in production unless NYUMBA_USE_MOCK_LISTINGS=1 */
export function mockListingsEnabled(): boolean {
  const flag = process.env.NYUMBA_USE_MOCK_LISTINGS;
  if (flag === "1" || flag === "true") return true;
  if (flag === "0" || flag === "false") return false;
  // Workers often omit NODE_ENV — only enable mocks in explicit local dev.
  return process.env.NODE_ENV === "development";
}

export function emptySearchResult(filters?: PropertySearchFilters) {
  const f = filters ?? {};
  const limit = f.limit ?? 50;
  const offset = f.offset ?? 0;
  return { items: [] as Property[], total: 0, limit, offset };
}

export function filterMockListings(filters?: PropertySearchFilters) {
  let items = [...MOCK_PROPERTIES];
  const f = filters ?? {};

  if (f.neighborhood && f.neighborhood !== "All") {
    items = items.filter((p) => p.neighborhood.toLowerCase() === f.neighborhood!.toLowerCase());
  }
  if (f.propertyType) items = items.filter((p) => p.property_type === f.propertyType);
  if (f.minRent) items = items.filter((p) => p.rent_kes >= f.minRent!);
  if (f.maxRent) items = items.filter((p) => p.rent_kes <= f.maxRent!);
  if (f.verifiedOnly) items = items.filter((p) => p.is_verified);
  if (f.minBedrooms != null) items = items.filter((p) => p.bedrooms >= f.minBedrooms!);
  if (f.query) {
    const term = f.query.toLowerCase();
    items = items.filter(
      (p) =>
        p.title.toLowerCase().includes(term) ||
        p.neighborhood.toLowerCase().includes(term) ||
        p.property_type.includes(term.replaceAll(" ", "_")),
    );
  }
  if (f.bounds) {
    items = items.filter(
      (p) =>
        p.latitude != null &&
        p.longitude != null &&
        p.latitude >= f.bounds!.minLat &&
        p.latitude <= f.bounds!.maxLat &&
        p.longitude >= f.bounds!.minLng &&
        p.longitude <= f.bounds!.maxLng,
    );
  }

  switch (f.sortBy ?? "newest") {
    case "price_asc":
      items.sort((a, b) => a.rent_kes - b.rent_kes);
      break;
    case "price_desc":
      items.sort((a, b) => b.rent_kes - a.rent_kes);
      break;
    case "score":
      items.sort((a, b) => (b.authenticity_score ?? 0) - (a.authenticity_score ?? 0));
      break;
    default:
      items.sort((a, b) => b.created_at.localeCompare(a.created_at));
  }

  const offset = f.offset ?? 0;
  const limit = f.limit ?? 50;
  const total = items.length;
  items = items.slice(offset, offset + limit);
  return { items, total, limit, offset };
}
