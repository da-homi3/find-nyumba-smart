import { describe, expect, it } from "vitest";
import {
  isBrokenListingImageUrl,
  listingPlaceholderUrl,
  normalizePropertyImages,
} from "@/lib/property-images";

describe("property-images", () => {
  it("detects broken seed URLs", () => {
    expect(
      isBrokenListingImageUrl(
        "https://images.unsplash.com/photo-1545324419-cc1a3fa10c00?w=800",
      ),
    ).toBe(true);
    expect(
      isBrokenListingImageUrl("https://images.unsplash.com/photo-1484154218962-a197022b5858"),
    ).toBe(false);
  });

  it("replaces broken URLs with valid placeholders", () => {
    const images = normalizePropertyImages(
      ["https://images.unsplash.com/photo-1545324419-cc1a3fa10c00?w=800"],
      "test-id",
    );
    expect(images[0]).toMatch(/^https:\/\/images\.unsplash\.com\/photo-/);
    expect(images[0]).not.toContain("1545324419");
  });

  it("returns a placeholder when images are empty", () => {
    expect(normalizePropertyImages([], "abc")).toHaveLength(1);
    expect(listingPlaceholderUrl("abc")).toMatch(/^https:\/\//);
  });
});
