import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/revenue/platform-settings", () => ({
  resolvePlusPlan: vi.fn(async () => ({
    monthlyKes: 700,
    quarterlyKes: 1800,
    quarterlyRegularKes: 2100,
    contactCreditsPerMonth: 10,
    features: [],
  })),
}));

import { applyServerDerivedTenantPlusAmount } from "@/lib/payments/initiate-payment-core";
import type { InitiatePaymentInput } from "@/lib/payments/initiate-payment-core";

function basePlus(overrides: Partial<InitiatePaymentInput> = {}): InitiatePaymentInput {
  return {
    amountKes: 1,
    paymentType: "tenant_plus",
    phoneNumber: "0712345678",
    paymentMethod: "mpesa",
    idempotencyKey: "test-idem-plus-checkout-01",
    title: "NyumbaSearch Plus",
    billingCycle: "monthly",
    plan: "plus",
    successPath: "/tenant/checkout",
    ...overrides,
  };
}

describe("applyServerDerivedTenantPlusAmount", () => {
  it("monthly checkout computes 700 KES with billingCycle monthly", async () => {
    const result = await applyServerDerivedTenantPlusAmount(
      basePlus({ amountKes: 9999, billingCycle: "monthly" }),
    );
    expect(result.amountKes).toBe(700);
    expect(result.billingCycle).toBe("monthly");
  });

  it("quarterly checkout computes 1800 KES with billingCycle quarterly", async () => {
    const result = await applyServerDerivedTenantPlusAmount(
      basePlus({ amountKes: 1890, billingCycle: "quarterly" }),
    );
    expect(result.amountKes).toBe(1800);
    expect(result.billingCycle).toBe("quarterly");
  });

  it("ignores client-sent amount entirely for tenant_plus", async () => {
    const wrong = await applyServerDerivedTenantPlusAmount(
      basePlus({ amountKes: 1, billingCycle: "quarterly" }),
    );
    expect(wrong.amountKes).toBe(1800);
  });

  it("leaves non-plus payments unchanged", async () => {
    const input = basePlus({
      paymentType: "lead_pack",
      amountKes: 2500,
      billingCycle: undefined,
      qty: 10,
    });
    const result = await applyServerDerivedTenantPlusAmount(input);
    expect(result.amountKes).toBe(2500);
  });
});
