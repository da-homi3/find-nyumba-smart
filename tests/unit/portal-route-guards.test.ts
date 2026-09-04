import { describe, expect, it } from "vitest";
import {
  evaluatePortalAccess,
  isPortalAuthOnlyPath,
  isPortalPublicEntry,
  userHasPortalRole,
} from "@/lib/route-guards/portal-access";
import type { AppRole } from "@/lib/portal-guard";

describe("portal route guards", () => {
  it("allows public landlord marketing entry without a session", () => {
    const decision = evaluatePortalAccess({
      portal: "landlord",
      pathname: "/landlord",
      roles: new Set(),
      userId: null,
    });
    expect(decision.allowed).toBe(true);
  });

  it("redirects unauthenticated users away from landlord dashboard", () => {
    const decision = evaluatePortalAccess({
      portal: "landlord",
      pathname: "/landlord/dashboard",
      roles: new Set(),
      userId: null,
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.redirectTo).toBe("/auth");
      expect(decision.redirectSearch?.redirect).toBe("/landlord/dashboard");
    }
  });

  it("allows checkout for signed-in users without landlord role", () => {
    expect(isPortalAuthOnlyPath("landlord", "/landlord/checkout")).toBe(true);
    const decision = evaluatePortalAccess({
      portal: "landlord",
      pathname: "/landlord/checkout",
      roles: new Set(["tenant"]),
      userId: "user-1",
    });
    expect(decision.allowed).toBe(true);
  });

  it("blocks tenants from admin routes when session is present", () => {
    const roles = new Set<AppRole>(["tenant"]);
    expect(userHasPortalRole(roles, "admin")).toBe(false);
    const decision = evaluatePortalAccess({
      portal: "admin",
      pathname: "/admin",
      roles,
      userId: "user-1",
    });
    expect(decision.allowed).toBe(false);
  });

  it("allows admins into any portal", () => {
    const roles = new Set<AppRole>(["admin"]);
    expect(userHasPortalRole(roles, "landlord")).toBe(true);
    expect(isPortalPublicEntry("manager", "/manager")).toBe(true);
  });
});
