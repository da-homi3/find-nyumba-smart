import { GEO_AREAS } from "@/lib/seo/areas";

/** Brand queries — own the name across search and social. */
export const BRAND_KEYWORDS = [
  "NyumbaSearch",
  "Nyumba Search",
  "NyumbaSearch Kenya",
  "NyumbaSearch app",
  "NyumbaSearch Nairobi",
  "nyumbasearch",
  "nyumbasearch.com",
] as const;

/** High-intent transactional queries (Nairobi-first; extend per county). */
export const TRANSACTIONAL_KEYWORDS = [
  "houses for rent in Nairobi",
  "apartments for rent in Nairobi",
  "affordable apartments in Nairobi",
  "rental houses Kenya",
  "apartments Kenya",
  "student accommodation Nairobi",
  "bedsitter for rent Nairobi",
  "2 bedroom apartment Nairobi",
  "houses without agents in Kenya",
  "verified rentals Nairobi",
] as const;

/** Informational / AEO queries — answer in content, FAQs, and video titles. */
export const INFORMATIONAL_KEYWORDS = [
  "how to find a house in Nairobi",
  "how much rent costs in Nairobi",
  "best areas to rent in Nairobi",
  "best estates to live in Nairobi",
  "safest areas to live in Nairobi",
  "things to check before renting a house",
  "how to avoid rental scams Kenya",
  "affordable areas to live in Nairobi",
  "how to find a house without an agent",
] as const;

export const PROPERTY_TYPES = [
  "bedsitter",
  "studio",
  "single room",
  "1 bedroom",
  "2 bedroom",
  "3 bedroom",
  "apartment",
  "house",
  "maisonette",
  "townhouse",
] as const;

export type PropertyTypeLabel = (typeof PROPERTY_TYPES)[number];

const TYPE_LABEL: Record<string, string> = {
  bedsitter: "bedsitter",
  studio: "studio",
  single_room: "single room",
  one_bedroom: "1 bedroom",
  two_bedroom: "2 bedroom",
  three_bedroom: "3 bedroom",
  apartment: "apartment",
  house: "house",
  maisonette: "maisonette",
  townhouse: "townhouse",
};

export function propertyTypeLabel(raw: string): string {
  return TYPE_LABEL[raw] ?? raw.replaceAll("_", " ");
}

/** Programmatic location keyword: "[type] for rent in [area]" */
export function locationKeyword(typeLabel: string, areaName: string): string {
  const t = typeLabel.trim().toLowerCase();
  const area = areaName.trim();
  if (!area) return `${t} for rent in Nairobi`;
  return `${t} for rent in ${area}`;
}

/** Generate location × type combinations for content planning (cap to avoid spam). */
export function buildLocationKeywordMatrix(options?: {
  areas?: readonly { name: string; slug: string }[];
  types?: readonly string[];
  max?: number;
}): Array<{ keyword: string; area: string; slug: string; type: string }> {
  const areas = options?.areas ?? GEO_AREAS;
  const types = options?.types ?? ["apartment", "2 bedroom", "bedsitter", "house"];
  const max = options?.max ?? 200;
  const out: Array<{ keyword: string; area: string; slug: string; type: string }> = [];
  for (const area of areas) {
    for (const type of types) {
      if (out.length >= max) return out;
      out.push({
        keyword: locationKeyword(type, area.name),
        area: area.name,
        slug: area.slug,
        type,
      });
    }
  }
  return out;
}

/** Tiered hashtags — use sparingly; captions carry primary search weight. */
export function tieredHashtags(areaName?: string): {
  brand: string[];
  category: string[];
  location: string[];
  intent: string[];
} {
  const location = areaName
    ? [`#${areaName.replaceAll(/\s+/g, "")}`, "#Nairobi", "#Kenya"]
    : ["#Nairobi", "#Kenya"];
  return {
    brand: ["#NyumbaSearch"],
    category: ["#KenyaRealEstate", "#NairobiApartments", "#KenyaProperty"],
    location,
    intent: ["#HouseHunting", "#ApartmentHunting", "#RentInNairobi"],
  };
}
