import { getCacheKv } from "@/lib/kv/bindings";

export interface CacheConfig {
  kvTtl: number;
  staleWhileRevalidate?: number;
}

export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  platform_stats: { kvTtl: 120, staleWhileRevalidate: 300 },
  /** Short TTL — listings must appear quickly after upload. */
  listings_search: { kvTtl: 15, staleWhileRevalidate: 0 },
  testimonials: { kvTtl: 3600, staleWhileRevalidate: 7200 },
  intelligence_stats: { kvTtl: 300, staleWhileRevalidate: 900 },
  agency_featured: { kvTtl: 600, staleWhileRevalidate: 1800 },
  sitemap_xml: { kvTtl: 86400 },
  promo_status: { kvTtl: 90, staleWhileRevalidate: 120 },
};

type CacheEnvelope<T> = {
  value: T;
  expiresAt: number;
  staleUntil: number | null;
  cachedAt: string;
};

const LISTINGS_EPOCH_KEY = "listings_cache_epoch";

const memoryFallback = new Map<string, string>();

async function kvGet(key: string): Promise<string | null> {
  const kv = getCacheKv();
  if (kv) return kv.get(`cache:${key}`);
  return memoryFallback.get(key) ?? null;
}

async function kvPut(key: string, value: string, ttl: number): Promise<void> {
  const kv = getCacheKv();
  if (kv) {
    await kv.put(`cache:${key}`, value, { expirationTtl: Math.max(60, ttl) });
    return;
  }
  memoryFallback.set(key, value);
  setTimeout(() => memoryFallback.delete(key), ttl * 1000).unref?.();
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const raw = await kvGet(key);
  if (!raw) return null;
  try {
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    const now = Date.now();
    if (now < envelope.expiresAt) return envelope.value;
    // Stale-while-revalidate only returns fresh window; expired entries miss so we refetch.
    if (envelope.staleUntil && now < envelope.staleUntil) return envelope.value;
    return null;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(key: string, value: T, config: CacheConfig): Promise<void> {
  const now = Date.now();
  const envelope: CacheEnvelope<T> = {
    value,
    expiresAt: now + config.kvTtl * 1000,
    staleUntil: config.staleWhileRevalidate
      ? now + (config.kvTtl + config.staleWhileRevalidate) * 1000
      : null,
    cachedAt: new Date().toISOString(),
  };
  const ttl = config.kvTtl + (config.staleWhileRevalidate ?? 0);
  await kvPut(key, JSON.stringify(envelope), Math.max(60, ttl));
}

export async function withCache<T>(
  key: string,
  configName: keyof typeof CACHE_CONFIGS,
  fetcher: () => Promise<T>,
  options?: { forceRefresh?: boolean },
): Promise<{ data: T; cacheHit: boolean }> {
  const config = CACHE_CONFIGS[configName];
  if (!options?.forceRefresh) {
    const cached = await cacheGet<T>(key);
    if (cached !== null) return { data: cached, cacheHit: true };
  }
  const data = await fetcher();
  await cacheSet(key, data, config);
  return { data, cacheHit: false };
}

export async function cacheDelete(key: string): Promise<void> {
  const kv = getCacheKv();
  if (kv) await kv.delete(`cache:${key}`);
  memoryFallback.delete(key);
}

/** Monotonic epoch included in listings cache keys so invalidation is immediate. */
export async function getListingsCacheEpoch(): Promise<number> {
  const raw = await kvGet(LISTINGS_EPOCH_KEY);
  if (!raw) return 0;
  try {
    const parsed = JSON.parse(raw) as CacheEnvelope<number> | number;
    if (typeof parsed === "number" && Number.isFinite(parsed)) return parsed;
    if (parsed && typeof parsed === "object" && typeof parsed.value === "number") {
      return parsed.value;
    }
  } catch {
    const asInt = Number.parseInt(raw, 10);
    if (Number.isFinite(asInt)) return asInt;
  }
  return 0;
}

function clearListingKeysFromMemory() {
  for (const key of memoryFallback.keys()) {
    if (key === LISTINGS_EPOCH_KEY) continue;
    // Listing keys look like `e12|l50|o0|newest|...` or legacy `l50|o0|...`
    if (key.startsWith("e") || key.startsWith("l") || key.includes("|")) {
      memoryFallback.delete(key);
    }
  }
}

/**
 * Bust all listing search caches so newly uploaded / activated listings
 * appear on the tenant app immediately.
 */
export async function invalidateListingCaches(): Promise<void> {
  const epoch = await getListingsCacheEpoch();
  const next = epoch + 1;
  // Store bare number for fast reads (also works with envelope readers).
  await kvPut(LISTINGS_EPOCH_KEY, JSON.stringify(next), 60 * 60 * 24 * 365);
  clearListingKeysFromMemory();

  await Promise.all([
    cacheDelete("platform_stats"),
    cacheDelete("intelligence_stats"),
    cacheDelete("agency_featured"),
    cacheDelete("sitemap_xml"),
    // Legacy key (never matched real listings keys, but safe to clear).
    cacheDelete("listings_search:default"),
  ]);
}
