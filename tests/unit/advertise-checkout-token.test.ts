import { describe, expect, it } from "vitest";
import { timingSafeEqual } from "@/lib/security/timing-safe-equal";

describe("timingSafeEqual", () => {
  it("accepts matching tokens", () => {
    const token = "11111111-1111-4111-8111-111111111111";
    expect(timingSafeEqual(token, token)).toBe(true);
  });

  it("rejects mismatched or missing tokens", () => {
    const token = "11111111-1111-4111-8111-111111111111";
    expect(timingSafeEqual(token, "22222222-2222-4222-8222-222222222222")).toBe(false);
    expect(timingSafeEqual(token, "")).toBe(false);
  });
});
