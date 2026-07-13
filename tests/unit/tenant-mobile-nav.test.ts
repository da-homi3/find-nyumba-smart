import { describe, expect, it } from "vitest";
import { shouldShowTenantBottomNav } from "@/lib/tenant-mobile-nav";

describe("shouldShowTenantBottomNav", () => {
  it("shows on tenant browse and map", () => {
    expect(shouldShowTenantBottomNav("/")).toBe(true);
    expect(shouldShowTenantBottomNav("/tenant")).toBe(true);
    expect(shouldShowTenantBottomNav("/tenant/map")).toBe(true);
    expect(shouldShowTenantBottomNav("/tenant/saved")).toBe(true);
    expect(shouldShowTenantBottomNav("/tenant/messages")).toBe(true);
  });

  it("hides on portal dashboards and checkout", () => {
    expect(shouldShowTenantBottomNav("/landlord/dashboard")).toBe(false);
    expect(shouldShowTenantBottomNav("/manager/dashboard")).toBe(false);
    expect(shouldShowTenantBottomNav("/tenant/checkout")).toBe(false);
    expect(shouldShowTenantBottomNav("/auth")).toBe(false);
  });

  it("hides on conversation threads", () => {
    expect(shouldShowTenantBottomNav("/tenant/messages/abc-123")).toBe(false);
  });
});
