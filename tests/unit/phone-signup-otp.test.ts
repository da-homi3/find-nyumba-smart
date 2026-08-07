import { describe, expect, it } from "vitest";
import {
  generateSixDigitPhoneOtp,
  phoneOtpCodesMatch,
  phoneSignupKvKey,
} from "@/lib/auth/phone-signup-otp-store";
import { phoneSignupOtpMessage } from "@/lib/sms/africas-talking";

describe("phone signup OTP helpers", () => {
  it("keys OTP store by 254 digits", () => {
    expect(phoneSignupKvKey("0712 345 678")).toBe("phonesignup:v1:254712345678");
    expect(phoneSignupKvKey("+254712345678")).toBe("phonesignup:v1:254712345678");
    expect(phoneSignupKvKey("bad")).toBeNull();
  });

  it("generates a 6-digit code", () => {
    const code = generateSixDigitPhoneOtp();
    expect(code).toMatch(/^\d{6}$/);
  });

  it("compares codes in constant time style", () => {
    expect(phoneOtpCodesMatch("123456", "123456")).toBe(true);
    expect(phoneOtpCodesMatch("123456", "123457")).toBe(false);
    expect(phoneOtpCodesMatch("12345", "12345")).toBe(false);
  });

  it("builds SMS copy with the code", () => {
    expect(phoneSignupOtpMessage("042189")).toContain("042189");
    expect(phoneSignupOtpMessage("042189")).toContain("NyumbaSearch");
  });
});
