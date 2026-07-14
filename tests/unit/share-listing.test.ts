import { describe, expect, it } from "vitest";
import { listingSharePath, listingShareText, whatsappShareUrl } from "@/lib/share-listing";

describe("share-listing helpers", () => {
  it("builds a property share path", () => {
    expect(listingSharePath("abc")).toBe("/tenant/property/abc");
  });

  it("builds share text with listing details", () => {
    const text = listingShareText({
      title: "2BR Kilimani",
      neighborhood: "Kilimani",
      rent_kes: 55000,
    });
    expect(text).toContain("2BR Kilimani");
    expect(text).toContain("Kilimani");
    expect(text).toContain("NyumbaSearch");
  });

  it("builds a WhatsApp share URL", () => {
    const url = whatsappShareUrl("https://nyumbasearch.com/tenant/property/1", "Nice home");
    expect(url.startsWith("https://wa.me/?text=")).toBe(true);
    expect(decodeURIComponent(url)).toContain("Nice home");
  });
});
