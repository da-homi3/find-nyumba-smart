export type FeaturedTestimonial = {
  name: string;
  roleLabel: string;
  body: string;
  rating: number;
};

export type PropertyIntelligenceStats = {
  kilimaniBoreholePercent: number;
  avgSecurityScore: number;
  westlandsFibrePercent: number;
  kilimaniSampleSize: number;
  westlandsSampleSize: number;
};

export type FeaturedAgency = {
  id: string;
  name: string;
  logoUrl: string | null;
  slug: string;
  listingCount: number;
};

export const FALLBACK_TESTIMONIALS: FeaturedTestimonial[] = [
  {
    name: "Faith W.",
    roleLabel: "Tenant · Kilimani",
    body: "Found my 1BR in two days. The verified badge actually meant something — landlord picked up on the first call.",
    rating: 5,
  },
  {
    name: "Brian O.",
    roleLabel: "Tenant · Westlands",
    body: "Honest reviews on water and security saved me from a place that looked perfect online. Worth its weight in gold.",
    rating: 5,
  },
  {
    name: "Achieng' M.",
    roleLabel: "Landlord · Lavington",
    body: "Filled a vacancy in 9 days, all leads pre-qualified. Way better than dealing with random WhatsApp brokers.",
    rating: 5,
  },
];

export const FALLBACK_INTELLIGENCE: PropertyIntelligenceStats = {
  kilimaniBoreholePercent: 72,
  avgSecurityScore: 4.2,
  westlandsFibrePercent: 89,
  kilimaniSampleSize: 0,
  westlandsSampleSize: 0,
};

function maskName(fullName: string | null | undefined): string {
  if (!fullName?.trim()) return "NyumbaSearch user";
  const parts = fullName.trim().split(/\s+/);
  const first = parts[0] ?? "User";
  if (parts.length === 1) return `${first.charAt(0).toUpperCase()}${first.slice(1)}.`;
  const initial = parts.at(-1)?.charAt(0)?.toUpperCase() ?? "";
  return `${first} ${initial}.`;
}

export function formatTestimonialRole(
  neighborhood: string | null | undefined,
  isLandlord: boolean,
): string {
  const hood = neighborhood?.trim() || "Nairobi";
  return isLandlord ? `Landlord · ${hood}` : `Tenant · ${hood}`;
}

export { maskName };
