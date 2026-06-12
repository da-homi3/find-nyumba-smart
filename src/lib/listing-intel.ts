import type { Property } from "@/lib/properties";

export type ReliabilityLabel = "Poor" | "Moderate" | "Good" | "Excellent";

export type ListingIntel = {
  subArea: string;
  water: ReliabilityLabel;
  security: ReliabilityLabel;
  internet: boolean;
  internetProviders: string[];
  parking: boolean;
  noise: "Low" | "Moderate" | "High";
  matatuRoute: string;
  commuteCbdMins: number;
  verifiedDaysAgo: number;
  borehole: boolean;
  gated: boolean;
  guard: boolean;
};

const HOOD_DEFAULTS: Record<
  string,
  Partial<ListingIntel> & { subAreas: string[]; providers: string[] }
> = {
  Kilimani: {
    subAreas: ["Argwings Kodhek", "Yaya", "Dennis Pritt"],
    water: "Good",
    security: "Excellent",
    providers: ["Safaricom", "Zuku", "Faiba"],
    matatuRoute: "Route 48 / 46",
    commuteCbdMins: 25,
  },
  Westlands: {
    subAreas: ["Parklands", "Highridge", "Sarit"],
    water: "Moderate",
    security: "Good",
    providers: ["Safaricom", "Zuku"],
    matatuRoute: "Route 11 / 106",
    commuteCbdMins: 20,
    noise: "High",
  },
  Kasarani: {
    subAreas: ["Mwiki", "Royale", "Garden Estate"],
    water: "Moderate",
    security: "Moderate",
    providers: ["Safaricom", "Faiba"],
    matatuRoute: "Route 17 / 45",
    commuteCbdMins: 45,
  },
  "South B": {
    subAreas: ["South C border", "Mugoya", "Ole Sereni"],
    water: "Good",
    security: "Good",
    providers: ["Safaricom", "Zuku"],
    matatuRoute: "Route 12",
    commuteCbdMins: 30,
  },
  Rongai: {
    subAreas: ["Tuskys area", "Maasai Lodge", "Kware"],
    water: "Poor",
    security: "Moderate",
    providers: ["Safaricom"],
    matatuRoute: "Route 126",
    commuteCbdMins: 75,
  },
  Ruaka: {
    subAreas: ["Ruaka Town", "Ndenderu", "Two Rivers"],
    water: "Moderate",
    security: "Good",
    providers: ["Safaricom", "Faiba"],
    matatuRoute: "Route 237",
    commuteCbdMins: 50,
  },
  Lavington: {
    subAreas: ["James Gichuru", "Valley Arcade"],
    water: "Excellent",
    security: "Excellent",
    providers: ["Safaricom", "Zuku", "Faiba"],
    matatuRoute: "Route 48",
    commuteCbdMins: 22,
  },
  Karen: {
    subAreas: ["Karen Road", "Langata South"],
    water: "Good",
    security: "Excellent",
    providers: ["Safaricom", "Zuku"],
    matatuRoute: "Route 24",
    commuteCbdMins: 40,
  },
};

function hashId(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + (id.codePointAt(i) ?? 0)) | 0;
  return Math.abs(h);
}

function scoreToLabel(n: number): ReliabilityLabel {
  if (n >= 4) return "Excellent";
  if (n >= 3) return "Good";
  if (n >= 2) return "Moderate";
  return "Poor";
}

export function getListingIntel(p: Property): ListingIntel {
  const hood = HOOD_DEFAULTS[p.neighborhood] ?? {
    subAreas: ["Central"],
    water: "Moderate" as ReliabilityLabel,
    security: "Moderate" as ReliabilityLabel,
    providers: ["Safaricom"],
    matatuRoute: "Matatu to CBD",
    commuteCbdMins: 40,
  };
  const h = hashId(p.id);
  const subArea = hood.subAreas?.[h % (hood.subAreas?.length || 1)] ?? p.neighborhood;
  const parking = (p.amenities ?? []).some((a) => /park/i.test(a)) || h % 3 !== 0;
  const daysSince = Math.floor(
    (Date.now() - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    subArea,
    water: hood.water ?? scoreToLabel(2 + (h % 3)),
    security: hood.security ?? scoreToLabel(2 + ((h >> 2) % 3)),
    internet: hood.providers.length > 0,
    internetProviders: hood.providers,
    parking,
    noise: hood.noise ?? (["Low", "Moderate", "High"] as const)[h % 3],
    matatuRoute: hood.matatuRoute ?? "CBD matatu",
    commuteCbdMins: hood.commuteCbdMins ?? 35,
    verifiedDaysAgo: Math.max(1, daysSince || (h % 14) + 1),
    borehole: (p.amenities ?? []).some((a) => /borehole|water/i.test(a)) || h % 2 === 0,
    gated: (p.amenities ?? []).some((a) => /gated|security/i.test(a)) || p.is_verified,
    guard: (p.amenities ?? []).some((a) => /guard|security/i.test(a)) || h % 2 === 1,
  };
}

export function formatVerifiedAgo(days: number) {
  if (days <= 1) return "Verified today";
  if (days < 7) return `Verified ${days} days ago`;
  if (days < 30) return `Verified ${Math.floor(days / 7)} wk ago`;
  return `Verified ${Math.floor(days / 30)} mo ago`;
}

export function verificationLevel(p: Property) {
  const score = p.authenticity_score ?? 70;
  if (!p.is_verified) return 0;
  if (score >= 90) return 4;
  if (score >= 75) return 3;
  if (score >= 60) return 2;
  return 1;
}
