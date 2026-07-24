const STORAGE_KEY = "nyumba-recent-searches";
const MAX = 8;

export type RecentSearch = {
  q: string;
  neighborhood?: string;
  at: number;
};

function readRaw(): RecentSearch[] {
  if (globalThis.localStorage === undefined) return [];
  try {
    const raw = globalThis.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is RecentSearch =>
          typeof item === "object" && item !== null && typeof (item as RecentSearch).q === "string",
      )
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function listRecentSearches(): RecentSearch[] {
  return readRaw();
}

export function pushRecentSearch(entry: { q: string; neighborhood?: string }): void {
  const q = entry.q.trim();
  if (q.length < 2) return;
  if (globalThis.localStorage === undefined) return;
  const next: RecentSearch[] = [
    { q, neighborhood: entry.neighborhood, at: Date.now() },
    ...readRaw().filter((r) => r.q.toLowerCase() !== q.toLowerCase()),
  ].slice(0, MAX);
  try {
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // quota / private mode
  }
}

export const POPULAR_SEARCHES = [
  "Kilimani",
  "Westlands",
  "Karen",
  "Lavington",
  "2 bedroom",
  "Bedsitter",
] as const;
