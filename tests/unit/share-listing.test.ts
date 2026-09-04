import { describe, expect, it } from "vitest";
import {
  listingSharePath,
  listingShareText,
  listingShareUrl,
  listingSocialCaption,
  whatsappShareUrl,
} from "@/lib/share-listing";
import { PLATFORM_PROFILE_COPY, formatProfileCopyMarkdown } from "@/lib/social/profile-copy";
import { appendSocialUtm } from "@/lib/social/content-engine";

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

  it("adds UTM params to share URLs", () => {
    const url = listingShareUrl("11111111-1111-4111-8111-111111111111");
    expect(url).toContain("utm_source=");
    expect(url).toContain("utm_campaign=listing_share");
  });

  it("builds an SEO social caption for paste", () => {
    const caption = listingSocialCaption({
      id: "11111111-1111-4111-8111-111111111111",
      title: "Sunny 2BR",
      neighborhood: "Kilimani",
      rent_kes: 80000,
      property_type: "two_bedroom",
      bedrooms: 2,
      amenities: ["Parking"],
      is_verified: true,
    });
    expect(caption).toContain("Kilimani");
    expect(caption).toContain("NyumbaSearch");
    expect(caption).toContain("#NyumbaSearch");
  });
});

describe("social UTM + profile copy", () => {
  it("appends UTMs without wiping other params", () => {
    const out = appendSocialUtm("https://nyumbasearch.com/areas/kilimani?ref=1", {
      source: "instagram",
      campaign: "location_guide",
      content: "kilimani",
    });
    expect(out).toContain("ref=1");
    expect(out).toContain("utm_source=instagram");
    expect(out).toContain("utm_content=kilimani");
  });

  it("includes platform profile copy for operators", () => {
    expect(PLATFORM_PROFILE_COPY.length).toBeGreaterThanOrEqual(6);
    expect(PLATFORM_PROFILE_COPY[0]?.profileUrl).toContain("instagram");
    expect(formatProfileCopyMarkdown()).toContain("Instagram");
    expect(formatProfileCopyMarkdown()).toContain("Pinned");
  });

  it("builds week-1 publish pack", async () => {
    const { buildWeek1PublishPack } = await import("@/lib/social/profile-copy");
    const week = buildWeek1PublishPack();
    expect(week).toHaveLength(7);
    expect(week[0]?.caption).toContain("NyumbaSearch");
    expect(week[0]?.destinationUrl).toContain("/areas/");
  });
});
