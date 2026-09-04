import { describe, expect, it } from "vitest";
import { isSafeRedirectPath } from "@/lib/portal-guard";

describe("post-login navigation safety", () => {
  it("accepts in-app redirect paths", () => {
    expect(isSafeRedirectPath("/tenant")).toBe(true);
    expect(isSafeRedirectPath("/tenant/saved")).toBe(true);
    expect(isSafeRedirectPath("/landlord/dashboard")).toBe(true);
  });

  it("rejects open redirects", () => {
    expect(isSafeRedirectPath("//evil.com")).toBe(false);
    expect(isSafeRedirectPath("https://evil.com")).toBe(false);
    expect(isSafeRedirectPath(undefined)).toBe(false);
  });
});
