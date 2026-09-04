import { describe, expect, it } from "vitest";
import { bookViewingCore, listViewingsForUser, updateViewingStatusCore } from "@/lib/viewings/core";

describe("viewings core validation", () => {
  it("rejects Sunday viewings in Nairobi time", async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "p1", owner_id: "l1", is_active: true },
              error: null,
            }),
          }),
        }),
      }),
    } as never;

    // 2026-08-30 is a Sunday
    await expect(
      bookViewingCore(admin, "tenant-1", {
        propertyId: "p1",
        scheduledAt: "2026-08-30T11:00:00+03:00",
      }),
    ).rejects.toThrow(/Sunday/i);
  });

  it("rejects past viewing slots", async () => {
    const admin = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "p1", owner_id: "l1", is_active: true },
              error: null,
            }),
          }),
        }),
      }),
    } as never;

    await expect(
      bookViewingCore(admin, "tenant-1", {
        propertyId: "p1",
        scheduledAt: "2020-01-02T11:00:00+03:00",
      }),
    ).rejects.toThrow(/future/i);
  });
});

describe("viewings core exports", () => {
  it("exports list and update helpers", () => {
    expect(typeof listViewingsForUser).toBe("function");
    expect(typeof updateViewingStatusCore).toBe("function");
  });
});
