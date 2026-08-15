import { describe, expect, it } from "vitest";
import {
  hashMpesaSmsContent,
  normalizeMpesaSmsForHash,
  resolveSmsClaimAmountKes,
} from "@/lib/pm/sms-claim-amount";

describe("sms-claim-amount", () => {
  it("caps amountOverride to parsed SMS amount", () => {
    expect(
      resolveSmsClaimAmountKes({ parsedAmountKes: 15000, amountOverride: 50000 }),
    ).toBe(15000);
    expect(
      resolveSmsClaimAmountKes({ parsedAmountKes: 15000, amountOverride: 10000 }),
    ).toBe(10000);
    expect(resolveSmsClaimAmountKes({ parsedAmountKes: 15000 })).toBe(15000);
  });

  it("hashes normalized SMS so whitespace edits collide", async () => {
    const a = await hashMpesaSmsContent("  ABC1 Confirmed. Ksh15,000  ");
    const b = await hashMpesaSmsContent("abc1 confirmed. ksh15,000");
    expect(a).toBe(b);
    expect(normalizeMpesaSmsForHash("a\n\nb")).toBe("A B");
  });
});
