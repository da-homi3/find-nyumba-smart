import { describe, expect, it } from "vitest";
import {
  evaluateMailboxlayer,
  evaluateNumverify,
  type MailboxlayerResult,
  type NumverifyResult,
} from "@/lib/apilayer/verify";

function email(partial: Partial<MailboxlayerResult>): MailboxlayerResult {
  return {
    configured: true,
    available: true,
    email: "user@example.com",
    formatValid: true,
    mxFound: true,
    smtpCheck: true,
    disposable: false,
    free: false,
    role: false,
    score: 0.9,
    didYouMean: null,
    ...partial,
  };
}

function phone(partial: Partial<NumverifyResult>): NumverifyResult {
  return {
    configured: true,
    available: true,
    number: "254712345678",
    valid: true,
    countryCode: "KE",
    location: "Nairobi",
    carrier: "Safaricom",
    lineType: "mobile",
    internationalFormat: "+254712345678",
    localFormat: "0712345678",
    ...partial,
  };
}

describe("mailboxlayer policy", () => {
  it("allows clean emails and fails open when unavailable", () => {
    expect(evaluateMailboxlayer(email({})).ok).toBe(true);
    expect(evaluateMailboxlayer(email({ configured: false, available: false })).ok).toBe(true);
    expect(evaluateMailboxlayer(email({ available: false })).ok).toBe(true);
  });

  it("blocks disposable and broken domains", () => {
    expect(evaluateMailboxlayer(email({ disposable: true })).ok).toBe(false);
    expect(evaluateMailboxlayer(email({ mxFound: false })).ok).toBe(false);
    expect(evaluateMailboxlayer(email({ formatValid: false })).ok).toBe(false);
    expect(evaluateMailboxlayer(email({ score: 0.1 })).ok).toBe(false);
  });

  it("allows free providers like Gmail", () => {
    expect(evaluateMailboxlayer(email({ free: true, email: "a@gmail.com" })).ok).toBe(true);
  });
});

describe("numverify policy", () => {
  it("allows valid Kenyan mobiles and fails open when unavailable", () => {
    expect(evaluateNumverify(phone({})).ok).toBe(true);
    expect(evaluateNumverify(phone({ available: false })).ok).toBe(true);
  });

  it("blocks invalid, foreign, and landline numbers", () => {
    expect(evaluateNumverify(phone({ valid: false })).ok).toBe(false);
    expect(evaluateNumverify(phone({ countryCode: "US" })).ok).toBe(false);
    expect(evaluateNumverify(phone({ lineType: "landline" })).ok).toBe(false);
  });
});
