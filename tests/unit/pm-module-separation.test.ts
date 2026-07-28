import { describe, expect, it } from "vitest";
import { invoiceStatusAfterPayment } from "@/lib/pm/invoice-status";
import { pickPmTier, type PmPricingTier } from "@/lib/pm/pricing";

const TIERS: PmPricingTier[] = [
  { id: "pm-starter", tier_name: "PM Starter", max_units: 10, price_kes: 1500 },
  { id: "pm-growth", tier_name: "PM Growth", max_units: 50, price_kes: 4000 },
  { id: "pm-scale", tier_name: "PM Scale", max_units: -1, price_kes: 9000 },
];

describe("pickPmTier", () => {
  it("recommends Starter for ≤10 units", () => {
    expect(pickPmTier(0, TIERS).tier).toBe("pm-starter");
    expect(pickPmTier(10, TIERS).tier).toBe("pm-starter");
  });

  it("recommends Growth for 11–50 units", () => {
    expect(pickPmTier(11, TIERS).tier).toBe("pm-growth");
    expect(pickPmTier(50, TIERS).priceKes).toBe(4000);
  });

  it("recommends Scale for 51+ units", () => {
    expect(pickPmTier(51, TIERS).tier).toBe("pm-scale");
    expect(pickPmTier(200, TIERS).priceKes).toBe(9000);
  });
});

describe("append-only invoice recompute (net of reversals)", () => {
  it("nets positive payment + negative reversal", () => {
    const amountDue = 50_000;
    const lateFee = 0;
    // Original 50k + erroneous 50k + reversal -50k = 50k paid
    const amountPaid = 50_000 + 50_000 + -50_000;
    expect(invoiceStatusAfterPayment(amountDue, amountPaid, lateFee)).toBe("paid");
  });

  it("marks partial when net is below owed", () => {
    const amountPaid = 20_000 + -5_000; // net 15k
    expect(invoiceStatusAfterPayment(50_000, amountPaid, 0)).toBe("partial");
  });

  it("marks pending when net is zero after full reversal", () => {
    expect(invoiceStatusAfterPayment(50_000, 50_000 + -50_000, 0)).toBe("pending");
  });
});
