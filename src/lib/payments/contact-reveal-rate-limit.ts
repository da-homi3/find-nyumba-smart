import type { SupabaseClient } from "@supabase/supabase-js";

/** Generous cap so real usage never hits it; blocks scrape-style abuse. */
export const CONTACT_REVEAL_RATE_LIMIT_24H = 60;

export class ContactRevealRateLimitError extends Error {
  constructor(
    message = "Too many contact reveals in 24 hours. Contact support if you believe this is an error.",
  ) {
    super(message);
    this.name = "ContactRevealRateLimitError";
  }
}

/**
 * Count unlock rows created by this user in the last 24 hours.
 * Used for both unlock initiation and getPropertyOwnerContact.
 */
export async function countContactRevealsLast24h(
  admin: SupabaseClient,
  userId: string,
): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("contact_unlocks")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) {
    console.warn("[contact-reveal] rate-limit count failed:", error.message);
    return 0;
  }
  return count ?? 0;
}

export async function assertContactRevealRateLimit(
  admin: SupabaseClient,
  userId: string,
): Promise<void> {
  const revealed = await countContactRevealsLast24h(admin, userId);
  if (revealed >= CONTACT_REVEAL_RATE_LIMIT_24H) {
    throw new ContactRevealRateLimitError();
  }
}
