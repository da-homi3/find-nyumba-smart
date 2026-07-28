import { describe, expect, it } from "vitest";
import { calculatePlatformFee, PLATFORM_FEE_RATE } from "@/lib/pm/platform-fee";
import { namesRoughlyMatch } from "@/lib/pm/payout-destinations";

describe("calculatePlatformFee", () => {
  it("takes 1% rounded of gross", () => {
    expect(PLATFORM_FEE_RATE).toBe(0.01);
    expect(calculatePlatformFee(15_000)).toEqual({
      platformFee: 150,
      netPayoutAmount: 14_850,
    });
  });

  it("rounds half-up via Math.round", () => {
    // 10001 * 0.01 = 100.01 → 100
    expect(calculatePlatformFee(10_001).platformFee).toBe(100);
    // 1050 * 0.01 = 10.5 → 11
    expect(calculatePlatformFee(1050)).toEqual({
      platformFee: 11,
      netPayoutAmount: 1039,
    });
  });

  it("handles zero", () => {
    expect(calculatePlatformFee(0)).toEqual({ platformFee: 0, netPayoutAmount: 0 });
  });
});

describe("namesRoughlyMatch", () => {
  it("ignores order, case, and punctuation", () => {
    expect(namesRoughlyMatch("Jane Wanjiku Kamau", "KAMAU, Jane Wanjiku")).toBe(true);
    expect(namesRoughlyMatch("Jane Kamau", "John Kamau")).toBe(false);
  });
});
