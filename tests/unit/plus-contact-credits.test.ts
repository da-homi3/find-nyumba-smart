import { describe, expect, it } from "vitest";
import {
  contactCreditsForFee,
  plusCreditsForBillingCycle,
  maxSavedProperties,
  maxComparedProperties,
  maxSavedSearchAlerts,
} from "@/lib/revenue/tenant-plus-config";

describe("Tenant Plus contact credit conversion", () => {
  it("maps unlock fees to credits", () => {
    expect(contactCreditsForFee(50)).toBe(1);
    expect(contactCreditsForFee(100)).toBe(1);
    expect(contactCreditsForFee(180)).toBe(2);
    expect(contactCreditsForFee(280)).toBe(3);
    expect(contactCreditsForFee(400)).toBe(4);
    expect(contactCreditsForFee(500)).toBe(5);
  });

  it("grants 10 monthly and 30 quarterly", () => {
    expect(plusCreditsForBillingCycle("monthly")).toBe(10);
    expect(plusCreditsForBillingCycle("quarterly")).toBe(30);
  });

  it("caps free saves at 10", () => {
    expect(maxSavedProperties(false)).toBe(10);
    expect(maxSavedProperties(true)).toBe(Number.POSITIVE_INFINITY);
  });

  it("caps free compare at 2 and Plus at 8", () => {
    expect(maxComparedProperties(false)).toBe(2);
    expect(maxComparedProperties(true)).toBe(8);
  });

  it("caps free search alerts at 1", () => {
    expect(maxSavedSearchAlerts(false)).toBe(1);
    expect(maxSavedSearchAlerts(true)).toBe(Number.POSITIVE_INFINITY);
  });
});
