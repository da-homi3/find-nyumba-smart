const buckets = new Map<string, { count: number; resetAt: number }>();

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 120;

/** Simple in-memory rate limiter for server functions (per IP/key). */
export function checkRateLimit(key: string): void {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  bucket.count += 1;
  if (bucket.count > MAX_REQUESTS) {
    throw new Error("Too many requests. Please try again in a minute.");
  }
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
