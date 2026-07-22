import { describe, expect, it } from "vitest";
import { unlockFeeForRent } from "@/lib/payments/unlock-pricing";

describe("unlockFeeForRent", () => {
  it("charges KES 30 for low rent", () => {
    expect(unlockFeeForRent(8_000)).toBe(30);
    expect(unlockFeeForRent(15_000)).toBe(30);
  });

  it("charges mid-tier fees", () => {
    expect(unlockFeeForRent(20_000)).toBe(50);
    expect(unlockFeeForRent(35_000)).toBe(80);
    expect(unlockFeeForRent(60_000)).toBe(100);
    expect(unlockFeeForRent(80_000)).toBe(120);
  });

  it("charges KES 150 for high rent", () => {
    expect(unlockFeeForRent(100_001)).toBe(150);
    expect(unlockFeeForRent(250_000)).toBe(150);
  });
});
