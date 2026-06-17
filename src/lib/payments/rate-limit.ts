const WINDOW_MS = 60_000;
const MAX_REQUESTS = 5;

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Per-user sliding window rate limit for payment initiation. */
export function assertPaymentRateLimit(userId: string): void {
  const now = Date.now();
  const bucket = buckets.get(userId);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (bucket.count >= MAX_REQUESTS) {
    throw new Error("Too many payment attempts. Please wait a minute and try again.");
  }

  bucket.count += 1;
}
