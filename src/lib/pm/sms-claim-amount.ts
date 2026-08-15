/** Normalize SMS text so trivial whitespace edits cannot bypass dedupe. */
export function normalizeMpesaSmsForHash(raw: string): string {
  return raw.replace(/\s+/g, " ").trim().toUpperCase();
}

/** SHA-256 hex digest via Web Crypto (Workers + Node; no node:crypto). */
export async function hashMpesaSmsContent(raw: string): Promise<string> {
  const normalized = normalizeMpesaSmsForHash(raw);
  const bytes = new TextEncoder().encode(normalized);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Credit amount cannot exceed the parsed SMS amount (fraud: override above SMS).
 * Still capped at invoice balance by the caller.
 */
export function resolveSmsClaimAmountKes(opts: {
  parsedAmountKes: number;
  amountOverride?: number | null;
}): number {
  const parsed = Math.max(0, Math.trunc(opts.parsedAmountKes));
  if (
    typeof opts.amountOverride === "number" &&
    Number.isInteger(opts.amountOverride) &&
    opts.amountOverride > 0
  ) {
    return Math.min(opts.amountOverride, parsed);
  }
  return parsed;
}
