import { TENANT_PLUS_CONFIG } from "@/lib/revenue/tenant-plus-config";
import { rateLimitDistributed } from "@/lib/api/rate-limit";

/** Per-user AI cost cap — KV-backed across Workers isolates. */
export async function assertAiUserRateLimit(userId: string): Promise<void> {
  const result = await rateLimitDistributed(`ai-user:${userId}`, {
    max: TENANT_PLUS_CONFIG.aiRequestsPerMinute,
    windowMs: 60_000,
  });
  if (result.limited) {
    throw new Error("AI rate limit reached. Try again in a minute.");
  }
}
