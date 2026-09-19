import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/revenue/subscription-store", () => ({
  getActiveLandlordPlan: vi.fn(),
  hasPaidMarketplacePortalAccess: vi.fn(),
}));

import {
  baseListingCap,
  listingCapReachedMessage,
  resolveEffectiveListingCap,
  resolveListingCap,
} from "@/lib/promo/listing-cap";

describe("resolveListingCap", () => {
  it("does not grant listings on the free plan even with bonus slots", () => {
    expect(resolveListingCap({ plan: "free", bonusSlots: 2 })).toBe(0);
  });

  it("admin override replaces plan and bonus", () => {
    expect(resolveListingCap({ plan: "pro", bonusSlots: 5, adminOverride: 12 })).toBe(12);
  });

  it("clamps admin override to 0–9999", () => {
    expect(resolveListingCap({ plan: "free", adminOverride: -3 })).toBe(0);
    expect(resolveListingCap({ plan: "free", adminOverride: 12000 })).toBe(9999);
  });

  it("adds bonus slots on a paid plan", () => {
    expect(resolveListingCap({ plan: "pro", bonusSlots: 2 })).toBe(12);
  });

  it("ignores null admin override", () => {
    expect(resolveListingCap({ plan: "agency-starter", bonusSlots: 0, adminOverride: null })).toBe(
      baseListingCap("agency-starter"),
    );
  });
});

describe("resolveEffectiveListingCap", () => {
  it("grants the pilot listing cap to unpaid participants", () => {
    expect(
      resolveEffectiveListingCap({
        paid: false,
        plan: "free",
        pilotListingLimit: 100,
      }),
    ).toBe(100);
  });

  it("keeps unpaid accounts at zero without a pilot", () => {
    expect(resolveEffectiveListingCap({ paid: false, plan: "free" })).toBe(0);
  });

  it("uses the higher of paid plan and pilot cap", () => {
    expect(
      resolveEffectiveListingCap({
        paid: true,
        plan: "pro",
        bonusSlots: 0,
        pilotListingLimit: 100,
      }),
    ).toBe(100);
  });

  it("still honours an admin override over the pilot", () => {
    expect(
      resolveEffectiveListingCap({
        paid: false,
        plan: "free",
        adminOverride: 3,
        pilotListingLimit: 100,
      }),
    ).toBe(3);
  });
});

describe("listingCapReachedMessage", () => {
  it("asks unpaid accounts to subscribe", () => {
    expect(listingCapReachedMessage(0)).toBe("Subscribe to a paid plan to list properties.");
  });

  it("shows the numeric cap when the plan is paid", () => {
    expect(listingCapReachedMessage(10)).toBe(
      "This account has reached its listing limit of 10. Upgrade the plan for more.",
    );
  });
});
