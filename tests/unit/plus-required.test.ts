import { describe, expect, it } from "vitest";
import { plusRequiredPayload } from "@/lib/payments/require-plus";
import { PLUS_PLAN } from "@/lib/revenue/plans";

describe("plusRequiredPayload", () => {
  it("uses live Plus monthly price and checkout path", () => {
    const payload = plusRequiredPayload();
    expect(payload.error).toBe("plus_required");
    expect(payload.upsell.priceMonthly).toBe(PLUS_PLAN.monthlyKes);
    expect(payload.upsell.checkoutUrl).toBe("/tenant/checkout?plan=plus");
  });
});
