import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
export const LISTING_PLACEHOLDERS = JSON.parse(
  readFileSync(join(root, "src", "data", "listing-placeholders.json"), "utf8"),
);

const BROKEN = /images\.unsplash\.com\/photo-15453244\d+-cc1a3fa10c00/i;

export function isBrokenListingImageUrl(url) {
  return BROKEN.test(String(url ?? "").trim());
}

function hashSeed(seed) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function listingPlaceholderUrl(seed) {
  const idx = typeof seed === "number" ? Math.abs(seed) : hashSeed(String(seed));
  return LISTING_PLACEHOLDERS[idx % LISTING_PLACEHOLDERS.length];
}

export function normalizePropertyImages(images, propertyId) {
  const raw = (images ?? []).map((u) => String(u).trim()).filter(Boolean);
  if (!raw.length) return [listingPlaceholderUrl(propertyId)];
  return raw.map((url, i) =>
    !url || isBrokenListingImageUrl(url) ? listingPlaceholderUrl(`${propertyId}-${i}`) : url,
  );
}
