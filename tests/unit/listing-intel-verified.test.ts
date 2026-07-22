import { describe, expect, it } from "vitest";
import { formatVerifiedAt, propertyVerifiedLabel } from "@/lib/listing-intel";
import type { Property } from "@/lib/properties";

describe("formatVerifiedAt", () => {
  it("always returns Verified", () => {
    expect(formatVerifiedAt("2026-07-21T08:00:00.000Z")).toBe("Verified");
    expect(formatVerifiedAt("2026-05-01T12:00:00.000Z")).toBe("Verified");
  });
});

describe("propertyVerifiedLabel", () => {
  it("returns Verified for verified properties", () => {
    const p = {
      is_verified: true,
      nyumba_verified_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    } as Property;
    expect(propertyVerifiedLabel(p)).toBe("Verified");
  });

  it("returns null when not verified", () => {
    const p = {
      is_verified: false,
      nyumba_verified_at: null,
      updated_at: "2026-07-01T00:00:00.000Z",
    } as Property;
    expect(propertyVerifiedLabel(p)).toBeNull();
  });
});
