import { describe, expect, it } from "vitest";
import {
  currentInvoicePeriod,
  demandHeadline,
  emptyDemand,
  invoiceNumber,
  payUrlForInvoice,
  planForAudience,
} from "@/lib/revenue/subscription-invoice";

describe("subscription invoices", () => {
  it("builds a stable invoice number for the billing month", () => {
    expect(invoiceNumber("landlord", "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee", "2026-08")).toBe(
      "NS-LAN-202608-AAAAAAAA",
    );
  });

  it("uses UTC calendar month for the period", () => {
    const period = currentInvoicePeriod(new Date("2026-08-19T21:00:00.000Z"));
    expect(period.monthKey).toBe("2026-08");
    expect(period.startIso).toBe("2026-08-01");
    expect(period.endIso).toBe("2026-08-31");
  });

  it("points owners at checkout and providers at the dashboard pay flow", () => {
    expect(payUrlForInvoice("landlord", "pro", "NS-1")).toContain("/landlord/checkout?plan=pro");
    expect(payUrlForInvoice("agency", "agency-pro", "NS-1")).toContain("/agency/checkout?plan=agency-pro");
    expect(payUrlForInvoice("provider", "basic", "NS-1")).toContain("/services/provider/dashboard?plan=basic");
  });

  it("charges the default paid listing plan, not free", () => {
    const landlord = planForAudience("landlord");
    expect(landlord.planId).toBe("pro");
    expect(landlord.amountKes).toBeGreaterThan(0);
  });

  it("describes real demand without inventing a search count of zero as a number of searches", () => {
    const empty = demandHeadline(emptyDemand(), "landlord");
    expect(empty.toLowerCase()).toContain("search");
    const withSearches = demandHeadline(
      { searches: 12, views: 3, inquiries: 0, areas: ["Kilimani"], categories: [] },
      "landlord",
    );
    expect(withSearches).toContain("12");
    expect(withSearches).toContain("Kilimani");
  });
});
