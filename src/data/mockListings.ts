import type { Property, PropertySearchFilters } from "@/lib/properties";

const IMG = (seed: number) =>
  `https://images.unsplash.com/photo-${1545324418 + seed}-cc1a3fa10c00?w=800&h=500&fit=crop`;

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
  base("a1000001-0001-4000-8000-000000000005", {
    owner_id: "b1000001-0001-4000-8000-000000000005",
    title: "1BR apartment — Rongai Maasai Lodge",
    property_type: "one_bedroom",
    neighborhood: "Rongai",
    address: "Maasai Lodge Rd",
    latitude: -1.3938,
    longitude: 36.7378,
    rent_kes: 16000,
    deposit_kes: 32000,
    bedrooms: 1,
    bathrooms: 1,
    area_sqm: 48,
    description: "Quiet 1-bedroom away from main road. Ideal for students and commuters.",
    amenities: ["Parking"],
    images: [IMG(7)],
    video_url: null,
    is_verified: false,
    is_active: true,
    is_vacant: true,
    authenticity_score: 58,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000006", {
    owner_id: "b1000001-0001-4000-8000-000000000006",
    title: "2BR with balcony — Ruaka",
    property_type: "two_bedroom",
    neighborhood: "Ruaka",
    address: "Ruaka Town",
    latitude: -1.2012,
    longitude: 36.7834,
    rent_kes: 28000,
    deposit_kes: 56000,
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 78,
    description: "Newer building with good water pressure and gated parking.",
    amenities: ["Parking", "Borehole", "CCTV"],
    images: [IMG(8)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 79,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000007", {
    owner_id: "b1000001-0001-4000-8000-000000000007",
    title: "Executive 2BR — Karen Hardy",
    property_type: "two_bedroom",
    neighborhood: "Karen",
    address: "Hardy",
    latitude: -1.3197,
    longitude: 36.7073,
    rent_kes: 95000,
    deposit_kes: 190000,
    bedrooms: 2,
    bathrooms: 3,
    area_sqm: 145,
    description: "Gated community with backup generator and excellent security.",
    amenities: ["Parking", "Generator", "Gym", "Pool"],
    images: [IMG(9), IMG(10)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 94,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000008", {
    owner_id: "b1000001-0001-4000-8000-000000000008",
    title: "1BR — Lavington Valley Arcade",
    property_type: "one_bedroom",
    neighborhood: "Lavington",
    address: "James Gichuru Rd",
    latitude: -1.2789,
    longitude: 36.7662,
    rent_kes: 55000,
    deposit_kes: 110000,
    bedrooms: 1,
    bathrooms: 1,
    area_sqm: 55,
    description: "Walk to Valley Arcade shops. Faiba and Safaricom fibre available.",
    amenities: ["Fibre", "Lift", "Parking"],
    images: [IMG(11)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 86,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000009", {
    owner_id: "b1000001-0001-4000-8000-000000000009",
    title: "Bedsitter — Roysambu TRM area",
    property_type: "bedsitter",
    neighborhood: "Roysambu",
    address: "Thika Rd",
    latitude: -1.2178,
    longitude: 36.8856,
    rent_kes: 11000,
    deposit_kes: 22000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 20,
    description: "Budget bedsitter near TRM. Shared water storage on roof.",
    amenities: ["Water tank"],
    images: [IMG(12)],
    video_url: null,
    is_verified: false,
    is_active: true,
    is_vacant: true,
    authenticity_score: 55,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000010", {
    owner_id: "b1000001-0001-4000-8000-000000000010",
    title: "2BR — Kileleshwa Mandera Rd",
    property_type: "two_bedroom",
    neighborhood: "Kileleshwa",
    address: "Mandera Rd",
    latitude: -1.2876,
    longitude: 36.7745,
    rent_kes: 48000,
    deposit_kes: 96000,
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 92,
    description: "Tree-lined street, quiet at night. Borehole + Nairobi Water backup.",
    amenities: ["Parking", "Borehole", "Balcony"],
    images: [IMG(13)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 81,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000011", {
    owner_id: "b1000001-0001-4000-8000-000000000011",
    title: "Studio — Kilimani State House Rd",
    property_type: "studio",
    neighborhood: "Kilimani",
    address: "State House Rd",
    latitude: -1.2967,
    longitude: 36.7898,
    rent_kes: 38000,
    deposit_kes: 76000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 38,
    description: "Furnished studio with kitchenette. Ideal for expats and consultants.",
    amenities: ["Furnished", "Fibre", "Parking"],
    images: [IMG(14)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 83,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000012", {
    owner_id: "b1000001-0001-4000-8000-000000000012",
    title: "1BR — South C Mugoya",
    property_type: "one_bedroom",
    neighborhood: "South C",
    address: "Mugoya Close",
    latitude: -1.3212,
    longitude: 36.8312,
    rent_kes: 26000,
    deposit_kes: 52000,
    bedrooms: 1,
    bathrooms: 1,
    area_sqm: 52,
    description: "Near Nairobi West shopping centre. Good matatu links.",
    amenities: ["Parking"],
    images: [IMG(15)],
    video_url: null,
    is_verified: false,
    is_active: true,
    is_vacant: true,
    authenticity_score: 67,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000013", {
    owner_id: "b1000001-0001-4000-8000-000000000013",
    title: "3BR townhouse — Karen Bogani",
    property_type: "townhouse",
    neighborhood: "Karen",
    address: "Bogani Rd",
    latitude: -1.3256,
    longitude: 36.7123,
    rent_kes: 115000,
    deposit_kes: 230000,
    bedrooms: 3,
    bathrooms: 3,
    area_sqm: 180,
    description: "Standalone townhouse with small compound. Pet-friendly.",
    amenities: ["Parking", "Garden", "Generator", "CCTV"],
    images: [IMG(16)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 91,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000014", {
    owner_id: "b1000001-0001-4000-8000-000000000014",
    title: "2BR — Westlands Sarit area",
    property_type: "two_bedroom",
    neighborhood: "Westlands",
    address: "Karuna Rd",
    latitude: -1.2623,
    longitude: 36.8012,
    rent_kes: 52000,
    deposit_kes: 104000,
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 88,
    description: "Walking distance to Sarit. Can be noisy on weekends.",
    amenities: ["Fibre", "Lift", "Parking"],
    images: [IMG(17)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 80,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000015", {
    owner_id: "b1000001-0001-4000-8000-000000000015",
    title: "Bedsitter — Kasarani Seasons",
    property_type: "bedsitter",
    neighborhood: "Kasarani",
    address: "Seasons Rd",
    latitude: -1.2189,
    longitude: 36.9123,
    rent_kes: 12500,
    deposit_kes: 25000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 21,
    description: "Near Kasarani stadium. Shared laundry area.",
    amenities: ["Water tank"],
    images: [IMG(18)],
    video_url: null,
    is_verified: false,
    is_active: true,
    is_vacant: true,
    authenticity_score: 60,
    available_from: now,
  }),
  base("a1000001-0001-4000-8000-000000000016", {
    owner_id: "b1000001-0001-4000-8000-000000000016",
    title: "1BR — Ruaka Banana",
    property_type: "one_bedroom",
    neighborhood: "Ruaka",
    address: "Banana Hill Rd",
    latitude: -1.1898,
    longitude: 36.7756,
    rent_kes: 22000,
    deposit_kes: 44000,
    bedrooms: 1,
    bathrooms: 1,
    area_sqm: 50,
    description: "Growing area with new malls. Good value for money.",
    amenities: ["Parking", "Borehole"],
    images: [IMG(19)],
    video_url: null,
    is_verified: true,
    is_active: true,
    is_vacant: true,
    authenticity_score: 74,
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
