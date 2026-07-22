import { getCacheKv } from "@/lib/kv/bindings";

const buckets = new Map<string, { count: number; resetAt: number }>();

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX = 120;
const BUCKET_SOFT_CAP = 4000;
const BUCKET_HARD_TARGET = 3000;

export const RATE_LIMITS = {
  signup: { max: 5, windowMs: 60_000 },
  portalSignup: { max: 5, windowMs: 60_000 },
  passwordReset: { max: 3, windowMs: 15 * 60_000 },
  payment: { max: 12, windowMs: 120_000 },
  mpesa: { max: 12, windowMs: 120_000 },
  stk: { max: 12, windowMs: 120_000 },
  stkPhone: { max: 15, windowMs: 120_000 },
  login: { max: 10, windowMs: 60_000 },
  search: { max: 90, windowMs: 60_000 },
  api: { max: 150, windowMs: 60_000 },
  whatsapp: { max: 30, windowMs: 60_000 },
  ai: { max: 20, windowMs: 60_000 },
} as const;

export type RateLimitOpts = {
  max?: number;
  windowMs?: number;
};

export type RateLimitResult = {
  limited: boolean;
  remaining: number;
  resetIn: number;
};

function pruneExpiredBuckets(now: number) {
  for (const [k, v] of buckets) {
    if (now > v.resetAt) buckets.delete(k);
  }
}

function pruneOldestBuckets(targetSize: number) {
  const excess = buckets.size - targetSize;
  if (excess <= 0) return;
  let removed = 0;
  for (const k of buckets.keys()) {
    buckets.delete(k);
    if (++removed >= excess) break;
  }
}

/** Bound memory growth across long-lived isolates. */
function pruneRateLimitBuckets(now: number) {
  if (buckets.size <= BUCKET_SOFT_CAP) return;
  pruneExpiredBuckets(now);
  if (buckets.size > BUCKET_SOFT_CAP) pruneOldestBuckets(BUCKET_HARD_TARGET);
}

function hitFreshBucket(key: string, max: number, windowMs: number, now: number): RateLimitResult {
  buckets.set(key, { count: 1, resetAt: now + windowMs });
  return { limited: false, remaining: max - 1, resetIn: Math.ceil(windowMs / 1000) };
}

function hitExistingBucket(
  bucket: { count: number; resetAt: number },
  max: number,
  now: number,
): RateLimitResult {
  bucket.count += 1;
  const resetIn = Math.max(0, Math.ceil((bucket.resetAt - now) / 1000));
  if (bucket.count > max) {
    return { limited: true, remaining: 0, resetIn };
  }
  return { limited: false, remaining: max - bucket.count, resetIn };
}

/** In-memory rate limiter for server functions (per IP/key). */
export function checkRateLimit(key: string, opts?: RateLimitOpts): void {
  const result = rateLimit(key, opts);
  if (result.limited) {
    throw new Error("Too many requests. Please try again in a minute.");
  }
}

export function rateLimit(key: string, opts?: RateLimitOpts): RateLimitResult {
  const max = opts?.max ?? DEFAULT_MAX;
  const windowMs = opts?.windowMs ?? DEFAULT_WINDOW_MS;
  const now = Date.now();

  pruneRateLimitBuckets(now);

  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    return hitFreshBucket(key, max, windowMs, now);
  }
  return hitExistingBucket(bucket, max, now);
}

/** KV-backed rate limit for infrastructure routes (distributed across Workers). */
export async function rateLimitDistributed(
  key: string,
  opts?: RateLimitOpts,
): Promise<RateLimitResult> {
  const max = opts?.max ?? DEFAULT_MAX;
  const windowSec = Math.ceil((opts?.windowMs ?? DEFAULT_WINDOW_MS) / 1000);
  const kv = getCacheKv();
  if (!kv) return rateLimit(key, opts);

  const countKey = `rl:${key}`;
  const blockKey = `rl:block:${key}`;

  try {
    const blocked = await kv.get(blockKey);
    if (blocked) {
      return { limited: true, remaining: 0, resetIn: Number.parseInt(blocked, 10) || windowSec };
    }

    const current = Number.parseInt((await kv.get(countKey)) || "0", 10) + 1;
    await kv.put(countKey, String(current), { expirationTtl: windowSec });

    if (current > max) {
      await kv.put(blockKey, String(windowSec), { expirationTtl: windowSec });
      logRateLimitBlocked(key, current).catch(() => {});
      return { limited: true, remaining: 0, resetIn: windowSec };
    }

    return { limited: false, remaining: Math.max(0, max - current), resetIn: windowSec };
  } catch (err) {
    console.error("[rate-limit] kv failed, using memory", err);
    return rateLimit(key, opts);
  }
}

async function logRateLimitBlocked(identifier: string, count: number): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("rate_limit_log").insert({
      id: crypto.randomUUID(),
      identifier: identifier.slice(0, 120),
      endpoint: identifier.split(":")[1] ?? "api",
      request_count: count,
      window_start: new Date().toISOString(),
      blocked: true,
    });
  } catch {
    // optional audit table
  }
}

export function applyRateLimitHeaders(
  response: Response,
  result: Pick<RateLimitResult, "remaining" | "resetIn">,
): Response {
  const headers = new Headers(response.headers);
  headers.set("X-RateLimit-Remaining", String(result.remaining));
  headers.set("X-RateLimit-Reset", String(Math.floor(Date.now() / 1000) + result.resetIn));
  if (result.remaining === 0) {
    headers.set("Retry-After", String(result.resetIn));
  }
  return new Response(response.body, { status: response.status, headers });
}

/** Extract a rate-limit key from request headers when available. */
export function rateLimitKeyFromHeaders(headers?: Headers): string {
  if (!headers) return "anonymous";
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "anonymous"
  );
}
