import { describe, expect, it } from "vitest";
import {
  paymentConfirmationEmail,
  contactUnlockEmail,
  passwordResetEmail,
  portalApprovedEmail,
} from "@/lib/email/templates";

describe("email templates", () => {
  it("payment confirmation includes amount and product", () => {
    const { subject, html, text } = paymentConfirmationEmail({
      name: "Jane",
      productName: "NyumbaSearch Plus",
      amountKes: 500,
      method: "M-Pesa",
      receiptRef: "ABC123",
      date: "11 Jun 2026",
      dashboardUrl: "https://example.com/billing",
    });
    expect(subject).toContain("500");
    expect(html).toContain("NyumbaSearch Plus");
    expect(text).toContain("ABC123");
  });

  it("contact unlock includes phone number", () => {
    const { html } = contactUnlockEmail({
      name: "Jane",
      listingTitle: "2BR Kilimani",
      neighborhood: "Kilimani",
      contactPhone: "0712345678",
      feeKes: 200,
      method: "M-Pesa",
      listingUrl: "https://example.com/p/1",
      plusUrl: "https://example.com/plus",
      showPlusUpsell: false,
    });
    expect(html).toContain("0712345678");
  });

  it("password reset includes OTP and link", () => {
    const { subject, html, text } = passwordResetEmail({
      resetLink: "https://nyumbasearch.com/auth/reset?code=abc",
      otpCode: "123456",
    });
    expect(subject).toContain("123456");
    expect(html).toContain("123456");
    expect(html).toContain("auth/reset");
    expect(text).toContain("123456");
  });

  it("portal approved includes dashboard link", () => {
    const { html } = portalApprovedEmail({
      name: "John",
      role: "landlord",
      dashboardUrl: "https://example.com/landlord/dashboard",
    });
    expect(html).toContain("landlord/dashboard");
  });
});
