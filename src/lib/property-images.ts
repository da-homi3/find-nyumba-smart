import heroNairobi from "@/assets/hero-nairobi.jpg";
import listingPlaceholders from "@/data/listing-placeholders.json";

/** Fabricated or dead Unsplash IDs from early seed data. */
const BROKEN_UNSPLASH_PATTERNS = [
  /images\.unsplash\.com\/photo-15453244\d+-cc1a3fa10c00/i,
  /images\.unsplash\.com\/photo-1560448204-e02f11c3d0e2/i,
];

const PLACEHOLDERS = listingPlaceholders as string[];

export const LOCAL_PROPERTY_PLACEHOLDER = heroNairobi;

function hashSeed(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function listingPlaceholderUrl(seed: string | number): string {
  const idx = typeof seed === "number" ? Math.abs(seed) : hashSeed(seed);
  return PLACEHOLDERS[idx % PLACEHOLDERS.length]!;
}

export function isBrokenListingImageUrl(url: string): boolean {
  const trimmed = url.trim();
  return BROKEN_UNSPLASH_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function normalizeListingImageUrl(url: string, seed: string): string {
  const trimmed = url.trim();
  if (!trimmed || isBrokenListingImageUrl(trimmed)) {
    return listingPlaceholderUrl(seed);
  }
  return trimmed;
}

export function normalizePropertyImages(
  images: string[] | null | undefined,
  propertyId: string,
): string[] {
  const raw = (images ?? []).map((u) => (typeof u === "string" ? u.trim() : "")).filter(Boolean);
  if (raw.length === 0) return [listingPlaceholderUrl(propertyId)];
  return raw.map((url, i) => normalizeListingImageUrl(url, `${propertyId}-${i}`));
}
