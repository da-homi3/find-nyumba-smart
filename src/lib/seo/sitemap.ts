import { getSiteUrl } from "@/lib/site";
import { allSitemapStaticPaths } from "@/lib/seo/static-routes";

function escapeXml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function urlEntry(
  loc: string,
  options?: { lastmod?: string; changefreq?: string; priority?: string },
): string {
  const lastmod = options?.lastmod ? `\n    <lastmod>${escapeXml(options.lastmod)}</lastmod>` : "";
  const changefreq = options?.changefreq
    ? `\n    <changefreq>${options.changefreq}</changefreq>`
    : "";
  const priority = options?.priority ? `\n    <priority>${options.priority}</priority>` : "";
  return `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod}${changefreq}${priority}\n  </url>`;
}

function sitemapPriority(path: string): string {
  if (path === "") return "1.0";
  if (path.startsWith("/services")) return "0.85";
  return "0.8";
}

export function buildStaticSitemapXml(baseUrl = getSiteUrl()): string {
  const today = new Date().toISOString().slice(0, 10);
  const urls = allSitemapStaticPaths()
    .map((path) =>
      urlEntry(`${baseUrl}${path}`, {
        lastmod: today,
        changefreq: "daily",
        priority: sitemapPriority(path),
      }),
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export async function buildFullSitemapXml(): Promise<string> {
  const base = getSiteUrl();
  const staticEntries = allSitemapStaticPaths().map((path) =>
    urlEntry(`${base}${path}`, {
      changefreq: "daily",
      priority: sitemapPriority(path),
    }),
  );

  let propertyEntries: string[] = [];
  try {
    const { createPublicClient } = await import("@/lib/api/public-client");
    const supabase = createPublicClient();
    const { data: properties } = await supabase
      .from("properties")
      .select("id, updated_at")
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(5000);

    propertyEntries = (properties ?? []).map((property) => {
      const lastmod =
        typeof property.updated_at === "string" ? property.updated_at.slice(0, 10) : undefined;
      return urlEntry(`${base}/tenant/property/${property.id}`, {
        lastmod,
        changefreq: "weekly",
        priority: "0.6",
      });
    });
  } catch (error) {
    console.warn("[sitemap] property fetch failed, serving static pages only:", error);
  }

  const urls = [...staticEntries, ...propertyEntries].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

export function sitemapResponse(xml: string, cacheHit = false): Response {
  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Cache": cacheHit ? "HIT" : "MISS",
    },
  });
}
