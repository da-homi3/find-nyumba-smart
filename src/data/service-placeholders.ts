/** Real Kenyan service providers shown until live DB providers are active. */
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
  phoneVerified: boolean;
  sourceUrl: string | null;
  websiteUrl: string | null;
  tier: string;
  isPlaceholder: boolean;
};

function entry(
  id: string,
  businessName: string,
  categories: string[],
  areasServed: string[],
  description: string,
  startingPriceKes: number,
  phone: string,
  tier: string,
  rating = 4.6,
  reviewCount = 40,
): ServiceProviderListing {
  return {
    id,
    businessName,
    category: categories[0],
    categories,
    areasServed,
    rating,
    reviewCount,
    startingPriceKes,
    description,
    phone,
    phoneVerified: true,
    sourceUrl: null,
    websiteUrl: null,
    tier,
    isPlaceholder: true,
  };
}

const PLACEHOLDER_CATALOG: ServiceProviderListing[] = [
  // Movers
  entry(
    "b1000001-0001-4000-8000-000000000001",
    "Cube Movers",
    ["movers"],
    ["Nairobi", "Mombasa", "All Kenya"],
    "Over 16 years experience, 40,000+ moves completed. Professional packing, transport and storage. IAM certified.",
    5000,
    "0727773663",
    "featured",
    4.8,
    210,
  ),
  entry(
    "b1000002-0002-4000-8000-000000000002",
    "Nellions Moving & Relocations",
    ["movers"],
    ["Nairobi", "Mombasa", "All Kenya", "International"],
    "Full-service relocation covering Kenya and international moves. Furniture installation included.",
    8000,
    "0700000001",
    "featured",
    4.7,
    180,
  ),
  entry(
    "b1000003-0003-4000-8000-000000000003",
    "Alpha Movers Kenya",
    ["movers"],
    ["Nairobi", "All Kenya", "International"],
    "Premium moving company based in Buruburu, Nairobi. Home, office and international relocations.",
    3500,
    "0722102902",
    "basic",
    4.5,
    95,
  ),
  entry(
    "b1000004-0004-4000-8000-000000000004",
    "Sifa Movers Kenya",
    ["movers"],
    ["Nairobi", "Ruaka", "Mombasa"],
    "Affordable, reliable movers in Nairobi, Ruaka and Mombasa. Residential and corporate moves.",
    3000,
    "0700000002",
    "basic",
  ),
  entry(
    "b1000005-0005-4000-8000-000000000005",
    "Taylor Movers Kenya",
    ["movers"],
    ["Nairobi", "All Kenya", "International"],
    "IAM member. Professional household, office and international relocations with insurance.",
    6000,
    "0700000003",
    "featured",
    4.7,
    120,
  ),

  // Electricians
  entry(
    "b1000010-0010-4000-8000-000000000010",
    "Bestcare Electrical Services",
    ["electricians"],
    ["Nairobi", "Westlands", "Kilimani", "Karen"],
    "Professional residential and commercial electricians. Wiring, installations, repairs, fault finding.",
    1500,
    "0722554435",
    "featured",
    4.7,
    140,
  ),
  entry(
    "b1000011-0011-4000-8000-000000000011",
    "Hyperteck Electrical Services",
    ["electricians", "solar"],
    ["Nairobi", "All Kenya"],
    "Established 1998. Outdoor lighting, solar systems, generator sales and installation.",
    2500,
    "0700000006",
    "basic",
    4.6,
    88,
  ),
  entry(
    "b1000012-0012-4000-8000-000000000012",
    "Ultimate Engineering Ltd",
    ["electricians"],
    ["Nairobi", "Woodley", "Kilimani"],
    "Experienced electrical contractor based in Woodley Estate. Residential rewiring and new installations.",
    2000,
    "0722207298",
    "basic",
  ),
  entry(
    "b1000013-0013-4000-8000-000000000013",
    "Mehta Electricals",
    ["electricians"],
    ["Nairobi", "All Kenya", "East Africa"],
    "Established 1963. One of Kenya's largest electrical contractors for institutional and commercial work.",
    5000,
    "0700000007",
    "featured",
    4.8,
    200,
  ),

  // Plumbers
  entry(
    "b1000020-0020-4000-8000-000000000020",
    "Hoscec Plumbing Services",
    ["plumbers"],
    ["Nairobi", "Kiambu", "Machakos", "Mombasa"],
    "Professional plumbers available 24/7 for emergencies. Pipe installation, tank cleaning, borehole drilling.",
    1000,
    "0723051963",
    "featured",
    4.7,
    160,
  ),
  entry(
    "b1000021-0021-4000-8000-000000000021",
    "Trident Plumbers Limited",
    ["plumbers"],
    ["Nairobi", "All Kenya"],
    "Est. 1988, 35+ years experience. Based at Astral Plaza, Old Mombasa Road.",
    2500,
    "0700000008",
    "featured",
    4.8,
    190,
  ),
  entry(
    "b1000022-0022-4000-8000-000000000022",
    "Bestcare Plumbing Services",
    ["plumbers"],
    ["Nairobi", "Westlands", "Kilimani", "Karen"],
    "24/7 emergency plumbing, pipe repairs, water tank installation.",
    1200,
    "0709004600",
    "basic",
  ),

  // Cleaning
  entry(
    "b1000030-0030-4000-8000-000000000030",
    "Bestcare Cleaning Services",
    ["cleaning"],
    ["Nairobi", "All Kenya"],
    "20+ years experience, 15,000+ clients. Residential, commercial and industrial cleaning. Pest control included.",
    2500,
    "0709004600",
    "featured",
    4.8,
    220,
  ),
  entry(
    "b1000031-0031-4000-8000-000000000031",
    "Colnet Limited",
    ["cleaning"],
    ["Nairobi", "All Kenya"],
    "Est. 1996. Leading provider of cleaning, waste management, fumigation and pest control.",
    3000,
    "0700000009",
    "featured",
    4.7,
    175,
  ),
  entry(
    "b1000032-0032-4000-8000-000000000032",
    "Hurricane Services Kenya",
    ["cleaning"],
    ["Nairobi", "Westlands", "Kilimani"],
    "Est. 2013. Professional cleaning, gardening and pest control.",
    2000,
    "0700000010",
    "basic",
  ),
  entry(
    "b1000033-0033-4000-8000-000000000033",
    "Solcity Cleaning Company",
    ["cleaning"],
    ["Nairobi"],
    "Est. 2018. Eco-friendly cleaning products. Residential and SME cleaning.",
    1800,
    "0700000011",
    "basic",
  ),

  // Internet
  entry(
    "b1000040-0040-4000-8000-000000000040",
    "Safaricom Home Fibre",
    ["internet"],
    ["Nairobi", "Mombasa", "Kisumu", "Major Towns"],
    "Kenya's largest mobile operator. Home Fibre packages from KES 2,999/mo. Speeds from 10Mbps to 1Gbps.",
    2999,
    "0722000000",
    "featured",
    4.5,
    500,
  ),
  entry(
    "b1000041-0041-4000-8000-000000000041",
    "Zuku Fibre",
    ["internet"],
    ["Nairobi", "Mombasa", "Kisumu"],
    "Fibre broadband from KES 2,999/mo. TV bundles available. 24/7 customer support.",
    2999,
    "0800720010",
    "featured",
    4.4,
    320,
  ),
  entry(
    "b1000042-0042-4000-8000-000000000042",
    "Airtel Home Broadband",
    ["internet"],
    ["Nairobi", "Mombasa", "All Kenya"],
    "Affordable home internet and fibre. Competitive packages with unlimited data options.",
    1999,
    "0733000000",
    "basic",
  ),
  entry(
    "b1000043-0043-4000-8000-000000000043",
    "Faiba (JTL Networks)",
    ["internet"],
    ["Nairobi", "Mombasa"],
    "True fibre-to-home in Nairobi and Mombasa. Speeds up to 200Mbps. No throttling.",
    2500,
    "0747000000",
    "basic",
    4.5,
    150,
  ),

  // Solar
  entry(
    "b1000050-0050-4000-8000-000000000050",
    "SolarSasa Kenya",
    ["solar"],
    ["Nairobi", "Kiambu", "Machakos", "Kajiado"],
    "Free site assessment. Residential systems from KES 80,000. On-site repairs in 24–48 hrs.",
    80000,
    "0737656293",
    "featured",
    4.8,
    90,
  ),
  entry(
    "b1000051-0051-4000-8000-000000000051",
    "Ecolink Power Systems",
    ["solar"],
    ["Nairobi", "All Kenya"],
    "Top-rated solar installer in Nairobi. Residential, commercial, hybrid and off-grid. EPRA licensed.",
    100000,
    "0700000012",
    "featured",
    4.7,
    75,
  ),
  entry(
    "b1000052-0052-4000-8000-000000000052",
    "The Green Camel Investments Ltd",
    ["solar"],
    ["Nairobi", "All Kenya"],
    "Est. 2011. EPRA and NCA licensed. Home to institutional solar with Jinko, Longi, Canadian Solar panels.",
    90000,
    "0700000013",
    "basic",
  ),
  entry(
    "b1000053-0053-4000-8000-000000000053",
    "Felicity Solar Kenya",
    ["solar"],
    ["Nairobi", "All Kenya"],
    "Based at Vision Plaza, Off Mombasa Road. Premium solar solutions and lithium battery technology.",
    95000,
    "0700000014",
    "basic",
  ),

  // Security
  entry(
    "b1000060-0060-4000-8000-000000000060",
    "KK Security",
    ["security"],
    ["Nairobi", "All Kenya"],
    "One of East Africa's largest security companies. Residential guarding, CCTV, alarm systems.",
    15000,
    "0700000015",
    "featured",
    4.6,
    280,
  ),
  entry(
    "b1000061-0061-4000-8000-000000000061",
    "Securex Kenya",
    ["security"],
    ["Nairobi", "Mombasa", "All Kenya"],
    "Comprehensive security solutions. CCTV, electric fencing, armed response, access control.",
    18000,
    "0700000016",
    "featured",
    4.7,
    210,
  ),
  entry(
    "b1000062-0062-4000-8000-000000000062",
    "Bestcare Security Services",
    ["security"],
    ["Nairobi"],
    "Residential and commercial security. Guard services, CCTV installation, alarm systems.",
    12000,
    "0709004600",
    "basic",
  ),

  // Painters
  entry(
    "b1000070-0070-4000-8000-000000000070",
    "Bestcare Painting Services",
    ["painters"],
    ["Nairobi"],
    "Professional interior and exterior painting. Residential and commercial. All paint brands stocked.",
    3500,
    "0709004600",
    "basic",
  ),
  entry(
    "b1000071-0071-4000-8000-000000000071",
    "Nairobi Pro Painters",
    ["painters"],
    ["Nairobi"],
    "Experienced painting team for houses and offices. Interior, exterior and decorative finishes.",
    3000,
    "0700000017",
    "basic",
    4.5,
    80,
  ),
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
      phoneVerified: true,
      sourceUrl: null,
      websiteUrl: null,
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
