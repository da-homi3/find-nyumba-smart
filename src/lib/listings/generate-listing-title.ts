import {
  isCommercialType,
  prettyPropertyType,
  type PropertyType,
} from "@/lib/property-types";

export type ListingTitleDetails = {
  property_type: PropertyType;
  neighborhood: string;
  bedrooms?: number | null;
  bathrooms?: number | null;
  address?: string | null;
  amenities?: string | string[] | null;
  area_sqm?: number | null;
  pricing_mode?: "rent" | "sale" | "booking" | null;
};

const AMENITY_HIGHLIGHTS: { match: RegExp; label: string }[] = [
  { match: /\b(parking|car\s*park)\b/i, label: "Parking" },
  { match: /\bensuite\b/i, label: "Ensuite" },
  { match: /\b(wifi|wi-?fi|fibre|fiber)\b/i, label: "WiFi" },
  { match: /\bborehole\b/i, label: "Borehole" },
  { match: /\b(generator|backup\s*power)\b/i, label: "Generator" },
  { match: /\bfurnished\b/i, label: "Furnished" },
  { match: /\b(swimming )?pool\b/i, label: "Pool" },
  { match: /\bgym\b/i, label: "Gym" },
  { match: /\bbalcony\b/i, label: "Balcony" },
  { match: /\bsecurity\b/i, label: "Security" },
];

const BEDROOM_TYPED = new Set<PropertyType>([
  "one_bedroom",
  "two_bedroom",
  "three_bedroom",
  "four_bedroom",
]);

function titleCaseWords(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (/^\d/.test(word)) {
        return word.charAt(0) + word.slice(1).toLowerCase();
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(" ");
}

function amenitiesBlob(amenities: ListingTitleDetails["amenities"]): string {
  if (!amenities) return "";
  if (Array.isArray(amenities)) return amenities.join(", ");
  return amenities;
}

function pickAmenityHighlight(amenities: ListingTitleDetails["amenities"]): string | null {
  const blob = amenitiesBlob(amenities);
  if (!blob.trim()) return null;
  for (const item of AMENITY_HIGHLIGHTS) {
    if (item.match.test(blob)) return item.label;
  }
  return null;
}

function addressSnippet(address: string | null | undefined): string | null {
  if (!address?.trim()) return null;
  const first = address
    .split(",")[0]
    ?.replace(/\s+/g, " ")
    .trim();
  if (!first || first.length < 3) return null;
  if (first.length <= 36) return first;
  return `${first.slice(0, 33).trimEnd()}…`;
}

function typePhrase(type: PropertyType, bedrooms: number): string {
  const label = titleCaseWords(prettyPropertyType(type));
  if (BEDROOM_TYPED.has(type)) return label;
  if (isCommercialType(type)) return label;
  if (type === "bedsitter" || type === "studio" || type === "single_room" || type === "hostel") {
    return label;
  }
  if (bedrooms > 0) return `${bedrooms} Bedroom ${label}`;
  return label;
}

function sizeSnippet(areaSqm: number | null | undefined, type: PropertyType): string | null {
  if (!areaSqm || areaSqm <= 0) return null;
  if (!isCommercialType(type) && areaSqm < 40) return null;
  const rounded = Math.round(areaSqm);
  return `${rounded} m²`;
}

function uniquenessToken(details: ListingTitleDetails): string {
  const raw = [
    details.property_type,
    details.neighborhood.trim().toLowerCase(),
    String(details.bedrooms ?? 0),
    String(details.bathrooms ?? 0),
    (details.address ?? "").trim().toLowerCase(),
    String(details.area_sqm ?? 0),
  ].join("|");
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.codePointAt(i) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36).toUpperCase().padStart(4, "0").slice(-4);
}

/**
 * Builds a distinctive listing title from structured property details.
 * Always includes a short stable token so identical type/area rows stay unique.
 */
export function generateListingTitle(details: ListingTitleDetails): string {
  const neighborhood = details.neighborhood.trim();
  if (!neighborhood) return "";

  const bedrooms = Number(details.bedrooms ?? 0);
  const bathrooms = Number(details.bathrooms ?? 0);
  const parts: string[] = [typePhrase(details.property_type, bedrooms)];

  if (bathrooms > 1 && !isCommercialType(details.property_type)) {
    parts[0] = `${parts[0]}, ${bathrooms} Bath`;
  }

  parts.push(`in ${titleCaseWords(neighborhood)}`);

  const extras: string[] = [];
  const address = addressSnippet(details.address);
  if (address) extras.push(address);
  const size = sizeSnippet(details.area_sqm, details.property_type);
  if (size && !address) extras.push(size);
  const amenity = pickAmenityHighlight(details.amenities);
  if (amenity && extras.length < 2) extras.push(amenity);
  if (details.pricing_mode === "sale") extras.push("For Sale");

  let title = parts.join(" ");
  if (extras.length > 0) title = `${title} · ${extras.join(" · ")}`;

  // Without an address, add a short stable unit code so same type/area rows stay unique.
  if (!address) {
    title = `${title} · Unit ${uniquenessToken(details)}`;
  }

  if (title.length > 120) {
    title = `${title.slice(0, 117).trimEnd()}…`;
  }
  return title;
}

/** True when the current title looks like one we previously auto-generated. */
export function isGeneratedListingTitle(
  title: string,
  details: ListingTitleDetails,
): boolean {
  const expected = generateListingTitle(details);
  if (!expected) return false;
  return title.trim() === expected;
}

export function listingTitleFromForm(details: ListingTitleDetails): string {
  return generateListingTitle(details);
}
