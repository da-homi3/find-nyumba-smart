import { describe, expect, it } from "vitest";
import { contactCreditsForFee } from "@/lib/revenue/tenant-plus-config";

/**
 * Mirrors refundAdminContactUnlock credit resolution (ledger → fee → fail loud).
 * Kept pure so CI does not need admin/auth fixtures.
 */
function resolveUnlockRefundCredits(input: {
  method: string;
  fee_charged: number | null;
  ledgerDelta: number | null;
}): number {
  if (input.method !== "plus" && input.method !== "credit") {
    return 0;
  }
  if (input.ledgerDelta != null && input.ledgerDelta < 0) {
    return Math.abs(input.ledgerDelta);
  }
  if ((input.fee_charged ?? 0) > 0) {
    return contactCreditsForFee(input.fee_charged ?? 0);
  }
  throw new Error(
    "No ledger entry / fee found — cannot determine correct refund amount. Escalate to manual review rather than guessing.",
  );
}

describe("contact unlock refund credit resolution", () => {
  it("prefers ledger debit magnitude", () => {
    expect(
      resolveUnlockRefundCredits({ method: "plus", fee_charged: 50, ledgerDelta: -2 }),
    ).toBe(2);
  });

  it("falls back to fee_charged band when ledger missing", () => {
    const credits = resolveUnlockRefundCredits({
      method: "credit",
      fee_charged: 100,
      ledgerDelta: null,
    });
    expect(credits).toBeGreaterThanOrEqual(1);
  });

  it("fails loudly when fee_charged is 0 and no ledger", () => {
    expect(() =>
      resolveUnlockRefundCredits({ method: "plus", fee_charged: 0, ledgerDelta: null }),
    ).toThrow(/manual review/i);
  });

  it("does not restore credits for trial unlocks", () => {
    expect(
      resolveUnlockRefundCredits({ method: "trial", fee_charged: 0, ledgerDelta: null }),
    ).toBe(0);
  });
});
