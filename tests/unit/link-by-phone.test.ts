import { describe, expect, it } from "vitest";
import { listingMatchesPhoneKeys, phoneMatchKeys } from "@/lib/listings/link-by-phone";

describe("phoneMatchKeys", () => {
  it("normalizes mixed Kenyan formats into one 254 key", () => {
    const keys = phoneMatchKeys("0712 345 678", "+254712345678", "254712345678");
    expect(keys.size).toBe(1);
    expect(keys.has("254712345678")).toBe(true);
  });

  it("ignores empty and invalid values", () => {
    const keys = phoneMatchKeys(null, "", "not-a-phone", "0712345678");
    expect(keys.has("254712345678")).toBe(true);
    expect(keys.size).toBe(1);
  });
});

describe("listingMatchesPhoneKeys", () => {
  const applicant = phoneMatchKeys("0712345678");

  it("matches legacy contact_phone in 254 form", () => {
    expect(
      listingMatchesPhoneKeys({ contact_phone: "254712345678", contact_phones: [] }, applicant),
    ).toBe(true);
  });

  it("matches a number inside contact_phones with spaces", () => {
    expect(
      listingMatchesPhoneKeys(
        {
          contact_phone: "0700111222",
          contact_phones: ["0700 111 222", "07 1234 5678"],
        },
        applicant,
      ),
    ).toBe(true);
  });

  it("does not match unrelated numbers", () => {
    expect(
      listingMatchesPhoneKeys(
        { contact_phone: "0799999999", contact_phones: ["254799999999"] },
        applicant,
      ),
    ).toBe(false);
  });

  it("returns false when applicant keys are empty", () => {
    expect(
      listingMatchesPhoneKeys({ contact_phone: "0712345678", contact_phones: [] }, new Set()),
    ).toBe(false);
  });
});
