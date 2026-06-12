import type { Property } from "@/lib/properties";
import { normalizePropertyImages } from "@/lib/property-images";

const STORAGE_KEY = "nyumba_recently_viewed";
const MAX_ITEMS = 8;

export type RecentProperty = Pick<
  Property,
  "id" | "title" | "neighborhood" | "rent_kes" | "images" | "property_type"
>;

function normalizeRecent(property: RecentProperty): RecentProperty {
  return {
    ...property,
    images: normalizePropertyImages(property.images, property.id),
  };
}

export function readRecentlyViewed(): RecentProperty[] {
  if (typeof globalThis.localStorage === "undefined") return [];
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentProperty[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS).map(normalizeRecent) : [];
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(property: RecentProperty) {
  if (typeof globalThis.localStorage === "undefined") return;
  const normalized = normalizeRecent(property);
  const existing = readRecentlyViewed().filter((p) => p.id !== normalized.id);
  const next = [normalized, ...existing].slice(0, MAX_ITEMS);
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
