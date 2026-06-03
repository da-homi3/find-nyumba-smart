import { describe, expect, it } from "bun:test";
import { ForbiddenError, requireRole } from "@/lib/api/_authz";

// Minimal mock of the Supabase client surface used by requireRole.
function mockSupabase(rolesByUser: Record<string, string[]>) {
  return {
    from(_table: string) {
      return {
        select(_cols: string) {
          return {
            eq(_col: string, userId: string) {
              const rows = (rolesByUser[userId] ?? []).map((role) => ({ role }));
              return Promise.resolve({ data: rows, error: null });
            },
          };
        },
      };
    },
  } as never;
}

describe("requireRole — authorization enforcement", () => {
  const TENANT = "00000000-0000-0000-0000-000000000001";
  const LANDLORD = "00000000-0000-0000-0000-000000000002";
  const NOBODY = "00000000-0000-0000-0000-000000000003";

  const sb = mockSupabase({
    [TENANT]: ["tenant"],
    [LANDLORD]: ["landlord"],
    [NOBODY]: [],
  });

  it("allows tenant to access tenant-only resource", async () => {
    await expect(requireRole(sb, TENANT, "tenant")).resolves.toBeUndefined();
  });

  it("rejects landlord trying to access tenant-only resource", async () => {
    await expect(requireRole(sb, LANDLORD, "tenant")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects tenant trying to access landlord-only resource", async () => {
    await expect(requireRole(sb, TENANT, "landlord")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("rejects user with no roles", async () => {
    await expect(requireRole(sb, NOBODY, "tenant")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows access when ANY required role matches", async () => {
    await expect(requireRole(sb, LANDLORD, ["tenant", "landlord"])).resolves.toBeUndefined();
  });
});
