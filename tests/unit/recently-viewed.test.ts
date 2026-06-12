import { describe, expect, it, beforeEach, vi } from "vitest";
import { pushRecentlyViewed, readRecentlyViewed } from "@/lib/recently-viewed";

const sample = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Test flat",
  neighborhood: "Kilimani",
  rent_kes: 45000,
  images: [],
  property_type: "apartment" as const,
};

describe("recently-viewed", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
    });
  });

  it("stores and reads recent properties", () => {
    pushRecentlyViewed(sample);
    const list = readRecentlyViewed();
    expect(list[0]?.id).toBe(sample.id);
  });

  it("dedupes by id and keeps newest first", () => {
    pushRecentlyViewed(sample);
    pushRecentlyViewed({ ...sample, title: "Updated" });
    const list = readRecentlyViewed();
    expect(list).toHaveLength(1);
    expect(list[0]?.title).toBe("Updated");
  });
});
