import { describe, expect, it } from "vitest";
import {
  formatKenyanPhoneDisplay,
  isKenyanPhone,
  resolveAccountPhone,
} from "@/lib/phone";

describe("phone helpers", () => {
  it("validates Kenyan mobiles", () => {
    expect(isKenyanPhone("0712345678")).toBe(true);
    expect(isKenyanPhone("+254712345678")).toBe(true);
    expect(isKenyanPhone("123")).toBe(false);
  });

  it("formats for display", () => {
    expect(formatKenyanPhoneDisplay("0712345678")).toBe("0712 345 678");
    expect(formatKenyanPhoneDisplay("+254712345678")).toBe("0712 345 678");
  });

  it("normalizes spaced input for M-Pesa", async () => {
    const { toMpesaPhone254, normalizeKenyanPhoneLocal } = await import("@/lib/phone");
    expect(toMpesaPhone254("0712 345 678")).toBe("254712345678");
    expect(normalizeKenyanPhoneLocal("0712 345 678")).toBe("0712345678");
  });

  it("prefers profile phone over metadata", () => {
    expect(
      resolveAccountPhone(
        { user_metadata: { phone: "0799999999" }, phone: null },
        "0712345678",
      ),
    ).toBe("0712345678");
  });
});
