import { getCacheKv } from "@/lib/kv/bindings";

export interface CacheConfig {
  kvTtl: number;
  staleWhileRevalidate?: number;
}

export const CACHE_CONFIGS: Record<string, CacheConfig> = {
  platform_stats: { kvTtl: 120, staleWhileRevalidate: 300 },
  listings_search: { kvTtl: 60, staleWhileRevalidate: 120 },
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

const memoryFallback = new Map<string, string>();

async function kvGet(key: string): Promise<string | null> {
  const kv = getCacheKv();
  if (kv) return kv.get(`cache:${key}`);
  return memoryFallback.get(key) ?? null;
}

async function kvPut(key: string, value: string, ttl: number): Promise<void> {
  const kv = getCacheKv();
  if (kv) {
    await kv.put(`cache:${key}`, value, { expirationTtl: ttl });
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
  await kvPut(key, JSON.stringify(envelope), ttl);
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

export async function invalidateListingCaches(): Promise<void> {
  await Promise.all([
    cacheDelete("platform_stats"),
    cacheDelete("listings_search:default"),
    cacheDelete("intelligence_stats"),
    cacheDelete("agency_featured"),
    cacheDelete("sitemap_xml"),
  ]);
}
