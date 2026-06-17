import { describe, expect, it } from "vitest";
import { unlockFeeForRent } from "@/lib/payments/unlock-pricing";

describe("unlockFeeForRent", () => {
  it("charges KES 50 for rent up to 20,000", () => {
    expect(unlockFeeForRent(8000)).toBe(50);
    expect(unlockFeeForRent(20_000)).toBe(50);
  });

  it("charges KES 100 for mid-tier rent", () => {
    expect(unlockFeeForRent(20_001)).toBe(100);
    expect(unlockFeeForRent(60_000)).toBe(100);
  });

  it("charges KES 150 for high rent", () => {
    expect(unlockFeeForRent(60_001)).toBe(150);
    expect(unlockFeeForRent(120_000)).toBe(150);
  });
});
