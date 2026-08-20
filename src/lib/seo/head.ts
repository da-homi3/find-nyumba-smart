import { getOgImageUrl, getSiteUrl } from "@/lib/site";
import { NAIROBI_GEO } from "@/lib/seo/faq";

export interface PageSeoInput {
  title: string;
  description: string;
  /** Route path, e.g. `/about` or `` for homepage. */
  path: string;
  ogImage?: string;
  ogType?: string;
  jsonLd?: object | object[];
  noIndex?: boolean;
  latitude?: number;
  longitude?: number;
  placename?: string;
}

const INDEX_ROBOTS = "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";

export function canonicalUrlForPath(path: string, baseUrl = getSiteUrl()): string {
  if (!path || path === "/") return baseUrl;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${baseUrl}${normalizedPath}`;
}

export function buildPageHead(input: PageSeoInput) {
  const canonical = canonicalUrlForPath(input.path);
  const ogImage = input.ogImage ?? getOgImageUrl();
  const robots = input.noIndex ? "noindex, nofollow" : INDEX_ROBOTS;
  const lat = input.latitude ?? NAIROBI_GEO.latitude;
  const lng = input.longitude ?? NAIROBI_GEO.longitude;
  const placename = input.placename ?? NAIROBI_GEO.placename;

  const head: {
    meta: Array<Record<string, string>>;
    links: Array<Record<string, string>>;
    scripts?: Array<{ type: string; children: string }>;
  } = {
    meta: [
      { title: input.title },
      { name: "description", content: input.description },
      { name: "robots", content: robots },
      { name: "language", content: NAIROBI_GEO.language },
      { name: "geo.region", content: NAIROBI_GEO.region },
      { name: "geo.placename", content: placename },
      { name: "geo.position", content: `${lat};${lng}` },
      { name: "ICBM", content: `${lat}, ${lng}` },
      { property: "og:site_name", content: "NyumbaSearch" },
      { property: "og:locale", content: NAIROBI_GEO.locale },
      { property: "og:locale:alternate", content: "sw_KE" },
      { property: "og:title", content: input.title },
      { property: "og:description", content: input.description },
      { property: "og:type", content: input.ogType ?? "website" },
      { property: "og:url", content: canonical },
      { property: "og:image", content: ogImage },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: input.title },
      { name: "twitter:description", content: input.description },
      { name: "twitter:image", content: ogImage },
    ],
    links: [
      { rel: "canonical", href: canonical },
      { rel: "alternate", hrefLang: "en-KE", href: canonical },
      { rel: "alternate", hrefLang: "x-default", href: canonical },
    ],
  };

  if (input.jsonLd) {
    const payloads = Array.isArray(input.jsonLd) ? input.jsonLd : [input.jsonLd];
    head.scripts = payloads.map((ld) => ({
      type: "application/ld+json",
      children: JSON.stringify(ld),
    }));
  }

  return head;
}
