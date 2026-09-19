import { describe, expect, it } from "vitest";
import { isScamAutoFlagged, SCAM_AUTO_FLAG_DEACTIVATES_LISTING } from "@/lib/trust/scam-auto-flag";

describe("scam auto-flag policy", () => {
  it("never auto-deactivates listings from a single report", () => {
    expect(SCAM_AUTO_FLAG_DEACTIVATES_LISTING).toBe(false);
  });

  it("flags viewing-fee / pay-before language for admin review", () => {
    expect(isScamAutoFlagged("other", "They asked for a viewing fee")).toBe(true);
    expect(isScamAutoFlagged("scam", "pay before you see the house")).toBe(true);
    expect(isScamAutoFlagged("booking fee demanded", null)).toBe(false);
    expect(isScamAutoFlagged("viewing fee", "landlord wanted cash")).toBe(true);
    expect(isScamAutoFlagged("wrong photos", "images look outdated")).toBe(false);
  });
});
