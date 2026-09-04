import { describe, expect, it, vi } from "vitest";

const { notifyUser } = vi.hoisted(() => ({
  notifyUser: vi.fn(async () => ({ id: "n1", skipped: false })),
}));

vi.mock("@/lib/notifications/notify-user", () => ({
  notifyUser,
}));

import {
  notifyLandlordNewApplication,
  notifyTenantApplicationUpdate,
  notifyViewingStatusChange,
} from "@/lib/notifications/rental-workflow-notify";

describe("rental workflow notifications", () => {
  it("notifies landlord on new application", async () => {
    notifyUser.mockClear();
    const admin = {} as never;
    await notifyLandlordNewApplication(admin, {
      landlordId: "landlord-1",
      applicationId: "app-1",
      propertyTitle: "Kilimani Studio",
      tenantName: "Jane",
      scorePercent: 72,
    });
    expect(notifyUser).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        userId: "landlord-1",
        type: "lead",
        href: "/landlord/applications",
        body: expect.stringContaining("Jane"),
      }),
    );
  });

  it("notifies tenant when application status changes", async () => {
    notifyUser.mockClear();
    const admin = {} as never;
    await notifyTenantApplicationUpdate(admin, {
      tenantId: "tenant-1",
      applicationId: "app-1",
      propertyTitle: "Westlands 2BR",
      status: "approved",
    });
    expect(notifyUser).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        userId: "tenant-1",
        type: "listing_match",
        href: "/tenant/applications",
        body: expect.stringContaining("approved"),
      }),
    );
  });

  it("notifies the other party on viewing status change", async () => {
    notifyUser.mockClear();
    const admin = {} as never;
    await notifyViewingStatusChange(admin, {
      viewingId: "view-1",
      propertyTitle: "Karen House",
      status: "confirmed",
      tenantId: "tenant-1",
      landlordId: "landlord-1",
      actorUserId: "landlord-1",
    });
    expect(notifyUser).toHaveBeenCalledWith(
      admin,
      expect.objectContaining({
        userId: "tenant-1",
        href: "/viewings",
        body: expect.stringContaining("confirmed"),
      }),
    );
  });
});
