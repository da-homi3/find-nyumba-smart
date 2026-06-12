import type { Property } from "@/lib/properties";

const STORAGE_KEY = "nyumba_recently_viewed";
const MAX_ITEMS = 8;

export type RecentProperty = Pick<
  Property,
  "id" | "title" | "neighborhood" | "rent_kes" | "images" | "property_type"
>;

export function readRecentlyViewed(): RecentProperty[] {
  if (typeof globalThis.localStorage === "undefined") return [];
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentProperty[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_ITEMS) : [];
  } catch {
    return [];
  }
}

export function pushRecentlyViewed(property: RecentProperty) {
  if (typeof globalThis.localStorage === "undefined") return;
  const existing = readRecentlyViewed().filter((p) => p.id !== property.id);
  const next = [property, ...existing].slice(0, MAX_ITEMS);
  globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}
