import { describe, expect, it } from "vitest";
import { computeTenantScore, TENANT_SCORE_RULES } from "@/lib/tenant/profile-score";
import { getPlusPricing } from "@/lib/revenue/plus-plan";
import { contactAccessLabel } from "@/lib/payments/unlock-pricing";

describe("getPlusPricing", () => {
  it("shows 2100 reference, 1800 offer, 300 savings, 600 effective monthly", () => {
    const p = getPlusPricing();
    expect(p.monthlyKes).toBe(700);
    expect(p.quarterlyRegularKes).toBe(2100);
    expect(p.quarterlyKes).toBe(1800);
    expect(p.savingsKes).toBe(300);
    expect(p.effectiveMonthlyKes).toBe(600);
  });
});

describe("computeTenantScore", () => {
  it("is a completeness percent, not eligibility", () => {
    const empty = computeTenantScore({
      phoneVerified: false,
      emailVerified: false,
      identityVerified: false,
      employmentVerified: false,
      incomeVerified: false,
      tenancyProvided: false,
      hasLocations: false,
      hasBudget: false,
      hasMoveIn: false,
      profileComplete: false,
    });
    expect(empty.percent).toBe(0);
    expect(empty.disclaimer).toMatch(/not a credit score/i);

    const full = computeTenantScore({
      phoneVerified: true,
      emailVerified: true,
      identityVerified: true,
      employmentVerified: true,
      incomeVerified: true,
      tenancyProvided: true,
      hasLocations: true,
      hasBudget: true,
      hasMoveIn: true,
      profileComplete: true,
    });
    expect(full.percent).toBe(100);
    expect(full.totalPoints).toBe(100);
  });

  it("ignores disabled rules", () => {
    const rules = TENANT_SCORE_RULES.map((r) =>
      r.id === "income" ? { ...r, enabled: false } : r,
    );
    const full = computeTenantScore(
      {
        phoneVerified: true,
        emailVerified: true,
        identityVerified: true,
        employmentVerified: true,
        incomeVerified: false,
        tenancyProvided: true,
        hasLocations: true,
        hasBudget: true,
        hasMoveIn: true,
        profileComplete: true,
      },
      rules,
    );
    expect(full.maxPoints).toBe(85);
    expect(full.percent).toBe(100);
  });
});

describe("contactAccessLabel", () => {
  it("labels premium contacts at 300+", () => {
    expect(contactAccessLabel(100)).toBe("Contact access");
    expect(contactAccessLabel(300)).toBe("Premium property contact");
  });
});
