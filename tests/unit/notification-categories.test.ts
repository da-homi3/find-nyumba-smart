import { describe, expect, it } from "vitest";
import { DEFAULT_NOTIFICATION_PREFERENCES, TYPE_TO_CATEGORY } from "@/lib/notifications/types";

function isCategoryOn(
  prefs: typeof DEFAULT_NOTIFICATION_PREFERENCES,
  type: keyof typeof TYPE_TO_CATEGORY,
): boolean {
  return prefs[TYPE_TO_CATEGORY[type]] !== false;
}

describe("notification category mapping", () => {
  it("maps listing_match to listings", () => {
    expect(TYPE_TO_CATEGORY.listing_match).toBe("listings");
  });

  it("maps maintenance types to maintenance", () => {
    expect(TYPE_TO_CATEGORY.maintenance_new).toBe("maintenance");
    expect(TYPE_TO_CATEGORY.maintenance_confirm).toBe("maintenance");
    expect(TYPE_TO_CATEGORY.complaint_new).toBe("maintenance");
    expect(TYPE_TO_CATEGORY.complaint_reply).toBe("maintenance");
  });

  it("maps rent and payment to payments", () => {
    expect(TYPE_TO_CATEGORY.rent).toBe("payments");
    expect(TYPE_TO_CATEGORY.payment).toBe("payments");
  });

  it("respects disabled category prefs", () => {
    const prefs = { ...DEFAULT_NOTIFICATION_PREFERENCES, messages: false };
    expect(isCategoryOn(prefs, "message")).toBe(false);
    expect(isCategoryOn(prefs, "lead")).toBe(false);
    expect(isCategoryOn(prefs, "announcement")).toBe(true);
  });
});
