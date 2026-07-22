import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/revenue/subscription-store", () => ({
  getActiveLandlordPlan: vi.fn(),
}));

import { baseListingCap, resolveListingCap } from "@/lib/promo/listing-cap";

describe("resolveListingCap", () => {
  it("uses plan limit plus bonus slots by default", () => {
    expect(resolveListingCap({ plan: "free", bonusSlots: 2 })).toBe(11);
  });

  it("admin override replaces plan and bonus", () => {
    expect(resolveListingCap({ plan: "pro", bonusSlots: 5, adminOverride: 12 })).toBe(12);
  });

  it("clamps admin override to 0–9999", () => {
    expect(resolveListingCap({ plan: "free", adminOverride: -3 })).toBe(0);
    expect(resolveListingCap({ plan: "free", adminOverride: 12000 })).toBe(9999);
  });

  it("ignores null admin override", () => {
    expect(resolveListingCap({ plan: "agency-starter", bonusSlots: 0, adminOverride: null })).toBe(
      baseListingCap("agency-starter"),
    );
  });
});