import { rateLimitDistributed, RATE_LIMITS } from "@/lib/api/rate-limit";

const STK_LIMIT_MESSAGE =
  "Too many M-Pesa prompt requests. Please wait a few minutes and try again.";

/** KV-backed rate limit for STK prompt initiation (checkout, unlock, WhatsApp, renewals). */
export async function assertStkPromptRateLimit(opts: {
  userId?: string;
  phone254?: string;
}): Promise<void> {
  if (opts.userId) {
    const user = await rateLimitDistributed(`stk:user:${opts.userId}`, RATE_LIMITS.stk);
    if (user.limited) throw new Error(STK_LIMIT_MESSAGE);
  }
  if (opts.phone254) {
    const phone = await rateLimitDistributed(`stk:phone:${opts.phone254}`, RATE_LIMITS.stkPhone);
    if (phone.limited) throw new Error(STK_LIMIT_MESSAGE);
  }
}

/** Per-user STK limit for payment initiation. */
export async function assertPaymentRateLimit(userId: string, phone254?: string): Promise<void> {
  await assertStkPromptRateLimit({ userId, phone254 });
}
