import { describe, expect, it } from "vitest";
import {
  collectionRatePercent,
  computePropertyHealthScore,
} from "@/lib/pm/property-health";
import {
  buildFinancialReportSummary,
  financialReportCsv,
  financialReportExcelXml,
  financialReportHtml,
} from "@/lib/pm/financial-report";
import { applyLoyaltyDiscount, resolveLoyaltyLevel } from "@/lib/loyalty/benefits";
import { reputationBadgeFromScore } from "@/lib/reputation/badge";
import { canTransition } from "@/lib/maintenance/state-machine";

describe("property health score", () => {
  it("scores a full occupancy / full collection property highly", () => {
    const result = computePropertyHealthScore({
      occupancyRate: 100,
      expectedIncomeKes: 100_000,
      collectedThisMonthKes: 100_000,
      totalUnits: 10,
      vacantUnits: 0,
      openMaintenanceRequests: 0,
      avgMaintenanceDays: 2,
    });
    expect(result.score).toBeGreaterThanOrEqual(85);
    expect(result.label).toBe("Excellent");
    expect(result.collectionRate).toBe(100);
  });

  it("penalizes vacancy and open maintenance", () => {
    const healthy = computePropertyHealthScore({
      occupancyRate: 90,
      expectedIncomeKes: 50_000,
      collectedThisMonthKes: 50_000,
      totalUnits: 10,
      vacantUnits: 1,
      openMaintenanceRequests: 0,
      avgMaintenanceDays: 3,
    });
    const stressed = computePropertyHealthScore({
      occupancyRate: 40,
      expectedIncomeKes: 50_000,
      collectedThisMonthKes: 10_000,
      totalUnits: 10,
      vacantUnits: 6,
      openMaintenanceRequests: 8,
      avgMaintenanceDays: 20,
    });
    expect(stressed.score).toBeLessThan(healthy.score);
  });

  it("treats zero expected income as full collection", () => {
    expect(collectionRatePercent(0, 0)).toBe(100);
  });
});

describe("financial report builders", () => {
  const rows = [
    {
      propertyName: "Kilimani Court",
      unitLabel: "A1",
      tenantName: "Ada",
      periodMonth: "2026-07",
      dueDate: "2026-07-05",
      amountDue: 25000,
      amountPaid: 25000,
      lateFee: 0,
      status: "paid",
    },
    {
      propertyName: "Kilimani Court",
      unitLabel: "A2",
      tenantName: "Ben",
      periodMonth: "2026-07",
      dueDate: "2026-07-05",
      amountDue: 30000,
      amountPaid: 10000,
      lateFee: 500,
      status: "partial",
    },
  ];

  it("summarizes due / paid / outstanding", () => {
    const summary = buildFinancialReportSummary("Kilimani Court", "2026-07", rows);
    expect(summary.invoiceCount).toBe(2);
    expect(summary.totalDue).toBe(55000);
    expect(summary.totalPaid).toBe(35000);
    expect(summary.totalOutstanding).toBe(20500);
  });

  it("builds csv / excel / html payloads", () => {
    const summary = buildFinancialReportSummary("Kilimani Court", "2026-07", rows);
    const csv = financialReportCsv(summary, rows);
    expect(csv.headers).toContain("Status");
    expect(csv.body[0]?.[1]).toBe("A1");
    expect(financialReportExcelXml(summary, rows)).toContain("Workbook");
    expect(financialReportHtml(summary, rows)).toContain("Save as PDF");
  });
});

describe("phase 4 trust helpers still pass", () => {
  it("loyalty discount and badge tiers", () => {
    expect(applyLoyaltyDiscount(2500, "gold")).toBe(2000);
    expect(resolveLoyaltyLevel(600)).toBe("gold");
    expect(reputationBadgeFromScore(90).label).toBe("Highly trusted");
    expect(reputationBadgeFromScore(30).label).toBeNull();
  });

  it("maintenance confirm transition remains valid", () => {
    expect(canTransition("completed", "confirmed")).toBe(true);
  });
});
