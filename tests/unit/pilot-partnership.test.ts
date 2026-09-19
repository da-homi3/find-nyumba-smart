import { describe, expect, it } from "vitest";
import {
  canTransitionPilotStatus,
  daysRemaining,
  isPilotAccessWindowOpen,
  kpiProgress,
  slugifyPartnerName,
} from "@/lib/pilot/types";
import { pickWinningPilotProperty } from "@/lib/pilot/attribution";
import { canViewLeadContactDetails } from "@/lib/revenue/entitlements";

describe("pilot lifecycle", () => {
  it("allows expected status transitions", () => {
    expect(canTransitionPilotStatus("DRAFT", "INVITED")).toBe(true);
    expect(canTransitionPilotStatus("UNDER_REVIEW", "APPROVED")).toBe(true);
    expect(canTransitionPilotStatus("ACTIVE", "COMPLETED")).toBe(true);
    expect(canTransitionPilotStatus("ACTIVE", "CONVERTED")).toBe(true);
    expect(canTransitionPilotStatus("CONVERTED", "ACTIVE")).toBe(false);
    expect(canTransitionPilotStatus("DECLINED", "APPROVED")).toBe(false);
  });

  it("computes days remaining and KPI progress", () => {
    const now = new Date("2026-09-09T12:00:00.000Z");
    expect(daysRemaining("2026-09-19", now)).toBe(11);
    expect(daysRemaining(null, now)).toBeNull();

    expect(kpiProgress(50, 100)).toEqual({ percentage: 50, status: "behind" });
    expect(kpiProgress(85, 100)).toEqual({ percentage: 85, status: "on_track" });
    expect(kpiProgress(100, 100)).toEqual({ percentage: 100, status: "met" });
  });

  it("opens complimentary listing access during the 31-day window", () => {
    const now = new Date("2026-09-19T12:00:00.000Z");
    expect(
      isPilotAccessWindowOpen(
        { status: "ACTIVE", pilot_start_date: "2026-09-19", pilot_end_date: "2026-10-20" },
        now,
      ),
    ).toBe(true);
    expect(
      isPilotAccessWindowOpen(
        { status: "APPROVED", pilot_start_date: "2026-09-19", pilot_end_date: "2026-10-20" },
        now,
      ),
    ).toBe(true);
    expect(
      isPilotAccessWindowOpen(
        { status: "PAUSED", pilot_start_date: "2026-09-19", pilot_end_date: "2026-10-20" },
        now,
      ),
    ).toBe(false);
    expect(
      isPilotAccessWindowOpen(
        { status: "ACTIVE", pilot_start_date: "2026-09-19", pilot_end_date: "2026-09-18" },
        now,
      ),
    ).toBe(false);
  });

  it("slugifies partner names", () => {
    expect(slugifyPartnerName("Anga Homes Ltd!")).toBe("anga-homes-ltd");
  });
});

describe("pilot attribution", () => {
  it("attributes to a single winner by latest approved_at (no double-count)", () => {
    const winner = pickWinningPilotProperty([
      {
        id: "pp-old",
        pilot_id: "pilot-a",
        approved_at: "2026-01-01T00:00:00.000Z",
        added_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "pp-new",
        pilot_id: "pilot-b",
        approved_at: "2026-06-01T00:00:00.000Z",
        added_at: "2026-05-01T00:00:00.000Z",
      },
      {
        id: "pp-mid",
        pilot_id: "pilot-c",
        approved_at: null,
        added_at: "2026-03-01T00:00:00.000Z",
      },
    ]);
    expect(winner?.pilot_id).toBe("pilot-b");
    expect(winner?.id).toBe("pp-new");
  });

  it("returns null for empty candidates", () => {
    expect(pickWinningPilotProperty([])).toBeNull();
  });
});

describe("pilot entitlements", () => {
  it("unlocks lead contacts during an active pilot even on the free plan", () => {
    expect(
      canViewLeadContactDetails({
        landlordPlan: "free",
        subscriptionStatus: "none",
        leadPackBalance: 0,
        pilotActive: true,
      }),
    ).toBe(true);
  });
});
