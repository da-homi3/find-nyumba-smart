import { describe, expect, it } from "vitest";
import { contactCreditsForFee } from "@/lib/revenue/tenant-plus-config";

describe("contact unlock credit bands", () => {
  it("maps fee bands to credits for refund restore", () => {
    expect(contactCreditsForFee(0)).toBe(1);
    expect(contactCreditsForFee(100)).toBe(1);
    expect(contactCreditsForFee(150)).toBe(2);
    expect(contactCreditsForFee(500)).toBe(5);
  });

  it("restores the band for a stored listing fee on Plus unlocks", () => {
    // Plus unlocks now persist fee_charged = listing unlock fee (not 0).
    expect(Math.max(1, contactCreditsForFee(300))).toBe(3);
  });
});
