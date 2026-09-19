import { describe, expect, it } from "vitest";
import { hasApiKeyPermission } from "@/lib/api/v1/router";

describe("API key scope enforcement", () => {
  it("keeps legacy listings keys limited to listing operations", () => {
    expect(hasApiKeyPermission("listings", "listings:read")).toBe(true);
    expect(hasApiKeyPermission("listings", "listings:write")).toBe(true);
    expect(hasApiKeyPermission("listings", "webhooks:write")).toBe(false);
  });

  it("supports explicit comma and space separated permissions", () => {
    expect(hasApiKeyPermission("listings:read, webhooks:write", "webhooks:write")).toBe(true);
    expect(hasApiKeyPermission("listings:read", "listings:write")).toBe(false);
  });

  it("supports all-access scopes", () => {
    expect(hasApiKeyPermission("*", "webhooks:write")).toBe(true);
    expect(hasApiKeyPermission("all", "listings:write")).toBe(true);
  });
});
