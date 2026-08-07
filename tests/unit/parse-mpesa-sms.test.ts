import { describe, expect, it } from "vitest";
import { parseMpesaSms, normalizeKenyanMpesaPhone } from "../../src/lib/pm/parse-mpesa-sms";

describe("parseMpesaSms", () => {
  it("parses a classic send confirmation", () => {
    const sms =
      "ABC1DE2F3G Confirmed. Ksh2,500.00 sent to JOHN DOE 254712345678 on 15/7/26 at 3:45 PM. New M-PESA balance is Ksh1,200.00.";
    const parsed = parseMpesaSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed!.receipt).toBe("ABC1DE2F3G");
    expect(parsed!.amountKes).toBe(2500);
    expect(parsed!.phone).toBe("254712345678");
    expect(parsed!.paidAt).toBeInstanceOf(Date);
  });

  it("parses received-from style messages", () => {
    const sms =
      "QWERTYUIOP Confirmed. You have received Ksh15,000.00 from MARY W 254798765432 on 1/8/2026 at 09:12 AM.";
    const parsed = parseMpesaSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed!.receipt).toBe("QWERTYUIOP");
    expect(parsed!.amountKes).toBe(15000);
  });

  it("parses KES without commas", () => {
    const sms = "ZXCVBNM123 Confirmed. KES 800.00 paid to Paybill 123456.";
    const parsed = parseMpesaSms(sms);
    expect(parsed).not.toBeNull();
    expect(parsed!.amountKes).toBe(800);
    expect(parsed!.receipt).toBe("ZXCVBNM123");
  });

  it("returns null for unrelated text", () => {
    expect(parseMpesaSms("Hello, please pay rent tomorrow")).toBeNull();
  });

  it("rejects pure numeric fake receipts", () => {
    expect(parseMpesaSms("1234567890 Confirmed. Ksh500.00 sent to someone")).toBeNull();
  });
});

describe("normalizeKenyanMpesaPhone", () => {
  it("normalizes local formats", () => {
    expect(normalizeKenyanMpesaPhone("0712345678")).toBe("254712345678");
    expect(normalizeKenyanMpesaPhone("+254712345678")).toBe("254712345678");
    expect(normalizeKenyanMpesaPhone("712345678")).toBe("254712345678");
  });
});
