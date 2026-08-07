import { describe, expect, it } from "vitest";
import { mpesaCallbackAmountMatches } from "@/lib/api/mpesa";

describe("mpesaCallbackAmountMatches", () => {
  it("accepts an exact match", () => {
    expect(mpesaCallbackAmountMatches(500, 500)).toBe(true);
  });

  it("absorbs provider decimal formatting", () => {
    expect(mpesaCallbackAmountMatches(500.0, 500)).toBe(true);
    expect(mpesaCallbackAmountMatches(499.6, 500)).toBe(true);
    expect(mpesaCallbackAmountMatches("500.00" as unknown as number, 500)).toBe(true);
  });

  it("rejects underpayment — the anti-fraud guard", () => {
    expect(mpesaCallbackAmountMatches(1, 500)).toBe(false);
    expect(mpesaCallbackAmountMatches(499, 500)).toBe(false);
  });

  it("rejects overpayment / any divergence on a fixed-amount STK charge", () => {
    expect(mpesaCallbackAmountMatches(600, 500)).toBe(false);
  });

  it("falls back to true when the callback omits the amount", () => {
    // The amount was fixed server-side at initiation; the atomic status gate still applies.
    expect(mpesaCallbackAmountMatches(null, 500)).toBe(true);
    expect(mpesaCallbackAmountMatches(undefined, 500)).toBe(true);
  });

  it("does not crash on a missing expected amount", () => {
    expect(mpesaCallbackAmountMatches(500, null)).toBe(true);
  });
});
