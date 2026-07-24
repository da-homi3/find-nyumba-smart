import { describe, expect, it } from "vitest";
import {
  calculateLateFeeKes,
  invoiceStatusAfterPayment,
  rentBalanceRemaining,
} from "@/lib/pm/invoice-status";
import { rentReminderSubject } from "@/lib/email/templates";

describe("rent balance + status with late fees", () => {
  it("computes remaining balance including late fee", () => {
    expect(rentBalanceRemaining(10000, 2000, 500)).toBe(8500);
    expect(rentBalanceRemaining(10000, 10000, 0)).toBe(0);
  });

  it("marks paid only when amount covers due + late fee", () => {
    expect(invoiceStatusAfterPayment(10000, 10000, 500)).toBe("partial");
    expect(invoiceStatusAfterPayment(10000, 10500, 500)).toBe("paid");
  });

  it("calculates one-shot late fee by weeks overdue", () => {
    const due = "2026-07-01";
    const oneWeekLater = new Date("2026-07-08T12:00:00.000Z").getTime();
    expect(calculateLateFeeKes(10000, 0, due, 5, oneWeekLater)).toBe(500);
    const threeWeeks = new Date("2026-07-22T12:00:00.000Z").getTime();
    expect(calculateLateFeeKes(10000, 0, due, 5, threeWeeks)).toBe(1500);
  });

  it("returns zero late fee before due date", () => {
    const due = "2026-07-10";
    const before = new Date("2026-07-05T12:00:00.000Z").getTime();
    expect(calculateLateFeeKes(10000, 0, due, 5, before)).toBe(0);
  });
});

describe("rent reminder subjects", () => {
  it("formats stage subjects", () => {
    expect(rentReminderSubject("due_today", "4B", 25000)).toContain("due today");
    expect(rentReminderSubject("overdue_7day", "4B", 25000)).toContain("7 days overdue");
  });
});
