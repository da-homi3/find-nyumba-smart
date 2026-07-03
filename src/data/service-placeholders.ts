/** Demo listings shown until real providers are active in each category. */
export type ServiceProviderListing = {
  id: string;
  businessName: string;
  category: string;
  categories: string[];
  areasServed: string[];
  rating: number;
  reviewCount: number;
  startingPriceKes: number;
  description: string;
  phone: string;
  tier: string;
  isPlaceholder: boolean;
};

const PLACEHOLDER_CATALOG: ServiceProviderListing[] = [
  {
    id: "b1000001-0001-4000-8000-000000000001",
    businessName: "Nairobi Plumbing Works",
    category: "plumbers",
    categories: ["plumbers"],
    areasServed: ["Westlands", "Kilimani", "Parklands"],
    rating: 4.8,
    reviewCount: 124,
    startingPriceKes: 2000,
    description: "24/7 emergency plumbing, leak repairs, and bathroom fittings across Nairobi.",
    phone: "+254712345678",
    tier: "featured",
    isPlaceholder: true,
  },
  {
    id: "b1000002-0002-4000-8000-000000000002",
    businessName: "Kileleshwa Electric Co.",
    category: "electricians",
    categories: ["electricians"],
    areasServed: ["Kileleshwa", "Lavington", "Westlands"],
    rating: 4.6,
    reviewCount: 89,
    startingPriceKes: 1500,
    description: "Certified electricians for homes, apartments, and small offices.",
    phone: "+254723456789",
    tier: "basic",
    isPlaceholder: true,
  },
  {
    id: "b1000003-0003-4000-8000-000000000003",
    businessName: "SwiftMove Nairobi",
    category: "movers",
    categories: ["movers"],
    areasServed: ["All Nairobi"],
    rating: 4.7,
    reviewCount: 210,
    startingPriceKes: 8000,
    description: "Professional movers with packing, lifting, and same-day availability.",
    phone: "+254734567890",
    tier: "featured",
    isPlaceholder: true,
  },
  {
    id: "b1000004-0004-4000-8000-000000000004",
    businessName: "Zuku Install Pro",
    category: "internet",
    categories: ["internet"],
    areasServed: ["Karen", "Runda", "Westlands"],
    rating: 4.5,
    reviewCount: 56,
    startingPriceKes: 2500,
    description: "Home fibre installation, router setup, and Wi-Fi optimization.",
    phone: "+254745678901",
    tier: "basic",
    isPlaceholder: true,
  },
  {
    id: "b1000005-0005-4000-8000-000000000005",
    businessName: "SafeHome Security",
    category: "security",
    categories: ["security"],
    areasServed: ["Karen", "Kilimani", "Runda"],
    rating: 4.6,
    reviewCount: 42,
    startingPriceKes: 4500,
    description: "CCTV, alarms, and access control for apartments and homes.",
    phone: "+254756789012",
    tier: "premium",
    isPlaceholder: true,
  },
  {
    id: "b1000006-0006-4000-8000-000000000006",
    businessName: "FreshCoat Painters",
    category: "painters",
    categories: ["painters"],
    areasServed: ["Westlands", "Kasarani", "Embakasi"],
    rating: 4.4,
    reviewCount: 67,
    startingPriceKes: 3500,
    description: "Interior and exterior painting with free color consultation.",
    phone: "+254767890123",
    tier: "basic",
    isPlaceholder: true,
  },
  {
    id: "b1000007-0007-4000-8000-000000000007",
    businessName: "SparkleClean Nairobi",
    category: "cleaning",
    categories: ["cleaning"],
    areasServed: ["Kilimani", "Lavington", "South B"],
    rating: 4.5,
    reviewCount: 98,
    startingPriceKes: 2500,
    description: "Move-in/move-out deep cleaning and weekly housekeeping.",
    phone: "+254778901234",
    tier: "basic",
    isPlaceholder: true,
  },
  {
    id: "b1000008-0008-4000-8000-000000000008",
    businessName: "SunGrid Solar",
    category: "solar",
    categories: ["solar"],
    areasServed: ["Karen", "Ngong", "Ruiru"],
    rating: 4.7,
    reviewCount: 31,
    startingPriceKes: 15000,
    description: "Solar panel installation, inverter setup, and backup systems.",
    phone: "+254789012345",
    tier: "featured",
    isPlaceholder: true,
  },
  {
    id: "b1000009-0009-4000-8000-000000000009",
    businessName: "G4S Kenya (Home Security)",
    category: "security",
    categories: ["security"],
    areasServed: ["Westlands", "Karen", "Kilimani", "Runda"],
    rating: 4.5,
    reviewCount: 156,
    startingPriceKes: 5500,
    description:
      "Alarm monitoring, armed response, and CCTV for residential estates — Kenya market leader.",
    phone: "+254709848000",
    tier: "premium",
    isPlaceholder: true,
  },
  {
    id: "b1000010-0010-4000-8000-000000000010",
    businessName: "Davis & Shirtliff Plumbing",
    category: "plumbers",
    categories: ["plumbers"],
    areasServed: ["Industrial Area", "Embakasi", "Thika Road corridor"],
    rating: 4.7,
    reviewCount: 203,
    startingPriceKes: 3500,
    description: "Water pumps, boreholes, tanks, and commercial plumbing across Kenya.",
    phone: "+254732117000",
    tier: "featured",
    isPlaceholder: true,
  },
  {
    id: "b1000011-0011-4000-8000-000000000011",
    businessName: "Copyway Movers Kenya",
    category: "movers",
    categories: ["movers"],
    areasServed: ["Nairobi CBD", "Westlands", "Mombasa Road"],
    rating: 4.6,
    reviewCount: 312,
    startingPriceKes: 12000,
    description:
      "Inter-county and local moves with packing crews — common Nairobi rates from KES 12k.",
    phone: "+254722233344",
    tier: "featured",
    isPlaceholder: true,
  },
  {
    id: "b1000012-0012-4000-8000-000000000012",
    businessName: "Faiba Home Fibre Install",
    category: "internet",
    categories: ["internet"],
    areasServed: ["Kilimani", "South C", "Parklands", "Ruiru"],
    rating: 4.4,
    reviewCount: 88,
    startingPriceKes: 3000,
    description: "Jamii Telecom Faiba setup, mesh Wi-Fi, and router configuration for apartments.",
    phone: "+254711054000",
    tier: "featured",
    isPlaceholder: true,
  },
  {
    id: "b1000013-0013-4000-8000-000000000013",
    businessName: "Sollatek Solar Nairobi",
    category: "solar",
    categories: ["solar"],
    areasServed: ["Karen", "Kitengela", "Kiambu Road"],
    rating: 4.8,
    reviewCount: 47,
    startingPriceKes: 85000,
    description:
      "Grid-tie and hybrid solar — typical Nairobi home systems from ~KES 85k after assessment.",
    phone: "+254733669000",
    tier: "premium",
    isPlaceholder: true,
  },
  {
    id: "b1000014-0014-4000-8000-000000000014",
    businessName: "Paint & Sip Interiors",
    category: "painters",
    categories: ["painters"],
    areasServed: ["Kileleshwa", "Lavington", "Syokimau"],
    rating: 4.5,
    reviewCount: 74,
    startingPriceKes: 4500,
    description: "Interior repainting — market rate ~KES 80–120/sq ft for standard 2-bed units.",
    phone: "+254722887766",
    tier: "basic",
    isPlaceholder: true,
  },
  {
    id: "b1000015-0015-4000-8000-000000000015",
    businessName: "Fidelity Electricians",
    category: "electricians",
    categories: ["electricians"],
    areasServed: ["Ngong Road", "Donholm", "Utawala"],
    rating: 4.6,
    reviewCount: 112,
    startingPriceKes: 2000,
    description: "EWURA-compliant wiring, DB upgrades, and prepaid meter troubleshooting.",
    phone: "+254733445566",
    tier: "featured",
    isPlaceholder: true,
  },
  {
    id: "b1000016-0016-4000-8000-000000000016",
    businessName: "Bella Casa Cleaning",
    category: "cleaning",
    categories: ["cleaning"],
    areasServed: ["Kilimani", "Westlands", "Rosslyn"],
    rating: 4.7,
    reviewCount: 156,
    startingPriceKes: 3500,
    description: "Deep cleaning from KES 3,500 for bedsitters; move-out packages available.",
    phone: "+254711223344",
    tier: "featured",
    isPlaceholder: true,
  },
];

const placeholderById = new Map(PLACEHOLDER_CATALOG.map((p) => [p.id, p]));

export function isPlaceholderProviderId(id: string): boolean {
  return placeholderById.has(id);
}

export function getPlaceholderProviderById(id: string): ServiceProviderListing | null {
  return placeholderById.get(id) ?? null;
}

export function placeholderProvidersForCategory(category: string): ServiceProviderListing[] {
  const matches = PLACEHOLDER_CATALOG.filter((p) => p.categories.includes(category));
  if (matches.length > 0) return matches;

  const slug = category
    .replaceAll(/[^a-z0-9]/gi, "")
    .slice(0, 8)
    .padEnd(8, "0");
  return [
    {
      id: `b1000099-0099-4000-8000-${slug.slice(0, 4)}0000${slug.slice(4, 8)}`,
      businessName: `Nairobi ${category.charAt(0).toUpperCase()}${category.slice(1)} Pros`,
      category,
      categories: [category],
      areasServed: ["Nairobi"],
      rating: 4.5,
      reviewCount: 12,
      startingPriceKes: 2000,
      description: `Sample ${category} provider — request a quote and we'll match you with vetted pros.`,
      phone: "+254700000000",
      tier: "basic",
      isPlaceholder: true,
    },
  ];
}

export function mergeWithPlaceholders(
  live: ServiceProviderListing[],
  category: string,
): ServiceProviderListing[] {
  if (live.length > 0) return live;
  return placeholderProvidersForCategory(category);
}
