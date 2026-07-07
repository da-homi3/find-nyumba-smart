import { describe, expect, it } from "vitest";
import { buildPageHead, canonicalUrlForPath } from "@/lib/seo/head";
import { allSitemapStaticPaths, SERVICE_CATEGORY_SLUGS } from "@/lib/seo/static-routes";
import staticRoutes from "@/lib/seo/staticRoutes.json";
import { buildStaticSitemapXml } from "@/lib/seo/sitemap";

describe("buildPageHead", () => {
  it("returns unique titles and canonical URLs per route", () => {
    const home = buildPageHead({
      title: "Home — NyumbaSearch",
      description: "Home description",
      path: "",
    });
    const about = buildPageHead({
      title: "About — NyumbaSearch",
      description: "About description",
      path: "/about",
    });

    const homeTitle = home.meta.find((m) => "title" in m)?.title;
    const aboutTitle = about.meta.find((m) => "title" in m)?.title;
    expect(homeTitle).not.toBe(aboutTitle);

    const homeCanonical = home.links.find((l) => l.rel === "canonical")?.href;
    const aboutCanonical = about.links.find((l) => l.rel === "canonical")?.href;
    expect(homeCanonical).toBe("https://nyumbasearch.com");
    expect(aboutCanonical).toBe("https://nyumbasearch.com/about");
  });

  it("sets noindex when requested", () => {
    const head = buildPageHead({
      title: "Auth",
      description: "Auth",
      path: "/auth",
      noIndex: true,
    });
    const robots = head.meta.find((m) => m.name === "robots")?.content;
    expect(robots).toContain("noindex");
  });

  it("includes JSON-LD scripts when provided", () => {
    const head = buildPageHead({
      title: "Test",
      description: "Test",
      path: "/test",
      jsonLd: { "@type": "WebPage", name: "Test" },
    });
    expect(head.scripts?.[0]?.type).toBe("application/ld+json");
    expect(head.scripts?.[0]?.children).toContain("WebPage");
  });
});

describe("canonicalUrlForPath", () => {
  it("normalizes homepage and inner paths", () => {
    expect(canonicalUrlForPath("", "https://nyumbasearch.com")).toBe("https://nyumbasearch.com");
    expect(canonicalUrlForPath("/pricing", "https://nyumbasearch.com")).toBe(
      "https://nyumbasearch.com/pricing",
    );
  });
});

describe("static route manifest parity", () => {
  it("keeps sitemap paths aligned with service categories manifest", () => {
    expect(staticRoutes.serviceCategories).toEqual([...SERVICE_CATEGORY_SLUGS]);
    const servicePaths = SERVICE_CATEGORY_SLUGS.map((slug) => `/services/${slug}`);
    for (const path of servicePaths) {
      expect(allSitemapStaticPaths()).toContain(path);
    }
  });

  it("includes every marketing path in generated static sitemap", () => {
    const xml = buildStaticSitemapXml("https://nyumbasearch.com");
    for (const path of staticRoutes.sitemapPaths) {
      const loc = path === "" ? "https://nyumbasearch.com" : `https://nyumbasearch.com${path}`;
      expect(xml).toContain(`<loc>${loc}</loc>`);
    }
  });
});
