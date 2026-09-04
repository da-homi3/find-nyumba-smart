import { describe, expect, it } from "vitest";
import {
  canWithdrawRentalApplication,
  formatRentalApplicationStatus,
  isActiveRentalApplicationStatus,
} from "@/lib/rental-applications/status";

describe("rental application status", () => {
  it("treats submitted, under_review, and approved as active", () => {
    expect(isActiveRentalApplicationStatus("submitted")).toBe(true);
    expect(isActiveRentalApplicationStatus("under_review")).toBe(true);
    expect(isActiveRentalApplicationStatus("approved")).toBe(true);
  });

  it("does not treat withdrawn or rejected as active", () => {
    expect(isActiveRentalApplicationStatus("withdrawn")).toBe(false);
    expect(isActiveRentalApplicationStatus("rejected")).toBe(false);
    expect(isActiveRentalApplicationStatus("unknown")).toBe(false);
  });

  it("allows withdrawal only for active applications", () => {
    expect(canWithdrawRentalApplication("submitted")).toBe(true);
    expect(canWithdrawRentalApplication("approved")).toBe(true);
    expect(canWithdrawRentalApplication("rejected")).toBe(false);
    expect(canWithdrawRentalApplication("withdrawn")).toBe(false);
  });

  it("formats status labels for UI", () => {
    expect(formatRentalApplicationStatus("under_review")).toBe("under review");
    expect(formatRentalApplicationStatus("submitted")).toBe("submitted");
  });
});
