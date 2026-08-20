import { describe, expect, it } from "vitest";
import { areaFromSlug, areaPathForName, areaSlug } from "@/lib/seo/areas";
import { buildPageHead } from "@/lib/seo/head";
import { buildRobotsTxt } from "@/lib/seo/robots";
import { allSitemapStaticPaths } from "@/lib/seo/static-routes";
import { NYUMBASEARCH_FAQS } from "@/lib/seo/faq";
import { buildHomepageJsonLd } from "@/lib/seo/brand-entity";
import { buildLlmsTxt } from "@/lib/seo/llms";

describe("discoverability", () => {
  it("allows crawlers on public paths and blocks private dashboards", () => {
    const robots = buildRobotsTxt();
    expect(robots).toContain("User-agent: *");
    expect(robots).toContain("Allow: /");
    expect(robots).toContain("Disallow: /admin");
    expect(robots).toContain("Disallow: /api");
    expect(robots).toContain("Disallow: /landlord/manage");
    expect(robots).not.toContain("Disallow: /auth");
    expect(robots).not.toContain("Disallow: /tenant/saved");
    expect(robots).not.toContain("Disallow: /settings");
    expect(robots).toContain("User-agent: GPTBot");
    expect(robots).toContain("User-agent: PerplexityBot");
    expect(robots).toContain("Sitemap: https://nyumbasearch.com/sitemap.xml");
    expect(robots).toContain("LLMs-Txt: https://nyumbasearch.com/llms.txt");
    expect(robots).not.toContain("Disallow: /tenant/property");
    expect(robots).not.toContain("Disallow: /areas");
    const gptStart = robots.indexOf("User-agent: GPTBot");
    const gptNext = robots.indexOf("User-agent:", gptStart + 1);
    const gptBlock = robots.slice(gptStart, gptNext > 0 ? gptNext : undefined);
    expect(gptBlock).toContain("Allow: /");
    expect(gptBlock).toContain("Disallow: /admin");
  });

  it("puts Nairobi neighbourhood landing pages in the sitemap", () => {
    const paths = allSitemapStaticPaths();
    expect(paths).toContain("/areas");
    expect(paths).toContain("/areas/kilimani");
    expect(paths).toContain("/areas/westlands");
    expect(paths).toContain("/tenant");
    expect(paths).toContain("/services/electricians");
  });

  it("maps neighbourhood names to crawlable /areas URLs", () => {
    expect(areaSlug("South B")).toBe("south-b");
    expect(areaFromSlug("kilimani")?.name).toBe("Kilimani");
    expect(areaPathForName("Westlands")).toBe("/areas/westlands");
    expect(areaFromSlug("not-a-real-hood")).toBeNull();
    expect(areaPathForName("Unknown Suburb")).toBeNull();
  });

  it("emits geo, locale, and canonical tags for public pages", () => {
    const head = buildPageHead({
      title: "Test",
      description: "Desc",
      path: "/about",
    });
    const names = head.meta.map((m) => m.name ?? m.property);
    expect(names).toContain("geo.region");
    expect(names).toContain("geo.placename");
    expect(names).toContain("og:locale");
    expect(head.links.some((l) => l.rel === "canonical")).toBe(true);
    expect(head.links.some((l) => l.hrefLang === "en-KE")).toBe(true);
  });

  it("includes FAQ answers for answer engines", () => {
    expect(NYUMBASEARCH_FAQS.length).toBeGreaterThanOrEqual(4);
    const graph = buildHomepageJsonLd();
    const types = graph["@graph"].map((node: { "@type": unknown }) => node["@type"]);
    expect(types).toContain("FAQPage");
    expect(JSON.stringify(graph)).toContain("Nairobi");
    const llms = buildLlmsTxt();
    expect(llms).toContain("Q: What is NyumbaSearch?");
    expect(llms).toContain("/areas/kilimani");
    expect(llms).toContain("Disallow: /admin");
  });
});
