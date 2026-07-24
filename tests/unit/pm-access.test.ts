import { describe, expect, it } from "vitest";
import { staffCan } from "@/lib/pm/permissions";
import { invoiceStatusAfterPayment } from "@/lib/pm/invoice-status";

describe("staffCan", () => {
  it("grants owner full access", () => {
    expect(staffCan("owner", "payments:create")).toBe(true);
    expect(staffCan("owner", "anything:else")).toBe(true);
  });

  it("allows property_manager unit/tenant/payment work", () => {
    expect(staffCan("property_manager", "units:create")).toBe(true);
    expect(staffCan("property_manager", "tenants:view")).toBe(true);
    expect(staffCan("property_manager", "invoices:view")).toBe(true);
    expect(staffCan("property_manager", "payments:create")).toBe(true);
  });

  it("allows caretaker maintenance but not invoices", () => {
    expect(staffCan("caretaker", "maintenance:update")).toBe(true);
    expect(staffCan("caretaker", "units:view")).toBe(true);
    expect(staffCan("caretaker", "invoices:view")).toBe(false);
    expect(staffCan("caretaker", "tenants:view")).toBe(true);
  });

  it("allows accountant billing permissions", () => {
    expect(staffCan("accountant", "payments:create")).toBe(true);
    expect(staffCan("accountant", "invoices:update")).toBe(true);
    expect(staffCan("accountant", "units:create")).toBe(false);
  });

  it("denies unknown roles", () => {
    expect(staffCan("unknown", "units:view")).toBe(false);
  });
});

describe("invoiceStatusAfterPayment", () => {
  it("stays pending when nothing paid", () => {
    expect(invoiceStatusAfterPayment(10000, 0)).toBe("pending");
  });

  it("becomes partial for incomplete payment", () => {
    expect(invoiceStatusAfterPayment(10000, 4000)).toBe("partial");
  });

  it("becomes paid when amount covers due", () => {
    expect(invoiceStatusAfterPayment(10000, 10000)).toBe("paid");
    expect(invoiceStatusAfterPayment(10000, 12000)).toBe("paid");
  });
});
