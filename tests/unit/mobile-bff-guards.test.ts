import { describe, expect, it, vi, beforeEach } from "vitest";
import { ForbiddenError } from "@/lib/api/_authz";
import {
  assertAgencyOrManagerRole,
  assertListerRole,
  assertPortalListerRole,
} from "@/lib/api/mobile/v1/guards";

const requireRole = vi.fn();
const userHasRole = vi.fn<(admin: unknown, userId: string, role: string) => Promise<boolean>>();

vi.mock("@/lib/api/_authz", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/_authz")>();
  return {
    ...actual,
    requireRole: (...args: unknown[]) => requireRole(...args),
  };
});

vi.mock("@/lib/api/mobile/v1/auth", () => ({
  userHasRole: (admin: unknown, userId: string, role: string) => userHasRole(admin, userId, role),
  mobileError: (message: string, code: string, status: number) =>
    new Response(JSON.stringify({ error: message, code }), { status }),
}));

const admin = {} as never;
const userId = "user-1";

describe("mobile BFF guards", () => {
  beforeEach(() => {
    requireRole.mockReset();
    userHasRole.mockReset();
  });

  it("assertListerRole passes when requireRole succeeds", async () => {
    requireRole.mockResolvedValue(undefined);
    await expect(assertListerRole(admin, userId)).resolves.toBeNull();
    expect(requireRole).toHaveBeenCalledWith(admin, userId, ["landlord", "manager", "agency"]);
  });

  it("assertListerRole returns 403 when requireRole throws ForbiddenError", async () => {
    requireRole.mockRejectedValue(new ForbiddenError("Lister role required"));
    const res = await assertListerRole(admin, userId);
    expect(res).toBeInstanceOf(Response);
    expect(res?.status).toBe(403);
  });

  it("assertAgencyOrManagerRole allows agency, manager, or admin", async () => {
    userHasRole.mockImplementation(async (_a, _u, role) => role === "manager");
    await expect(assertAgencyOrManagerRole(admin, userId)).resolves.toBeNull();
  });

  it("assertAgencyOrManagerRole rejects tenant-only users", async () => {
    userHasRole.mockResolvedValue(false);
    const res = await assertAgencyOrManagerRole(admin, userId);
    expect(res?.status).toBe(403);
  });

  it("assertPortalListerRole allows landlord portal roles", async () => {
    userHasRole.mockImplementation(async (_a, _u, role) => role === "landlord");
    await expect(assertPortalListerRole(admin, userId)).resolves.toBeNull();
  });

  it("assertPortalListerRole rejects tenants", async () => {
    userHasRole.mockResolvedValue(false);
    const res = await assertPortalListerRole(admin, userId);
    expect(res?.status).toBe(403);
  });
});
