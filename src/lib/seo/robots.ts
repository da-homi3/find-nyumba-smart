import { getSiteUrl } from "@/lib/site";
import { ROBOTS_DISALLOW_PATHS } from "@/lib/seo/static-routes";

export function buildRobotsTxt(): string {
  const site = getSiteUrl();
  return [
    "User-agent: *",
    "Allow: /",
    ...ROBOTS_DISALLOW_PATHS.map((path) => `Disallow: ${path}`),
    "",
    `Sitemap: ${site}/sitemap.xml`,
    `LLMs-Txt: ${site}/llms.txt`,
  ].join("\n");
}
