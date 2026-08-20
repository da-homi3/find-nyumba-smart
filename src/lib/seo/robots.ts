import { getSiteUrl } from "@/lib/site";
import { ROBOTS_DISALLOW_PATHS } from "@/lib/seo/static-routes";
import staticRoutes from "@/lib/seo/staticRoutes.json";

const AI_USER_AGENTS = staticRoutes.aiUserAgents as readonly string[];

function agentBlock(agent: string, disallows: readonly string[]): string[] {
  return [`User-agent: ${agent}`, "Allow: /", ...disallows.map((path) => `Disallow: ${path}`), ""];
}

export function buildRobotsTxt(): string {
  const site = getSiteUrl();
  const disallows = ROBOTS_DISALLOW_PATHS;
  return [
    "# NyumbaSearch crawl policy — public listings, areas, and services are indexable.",
    ...agentBlock("*", disallows),
    "# Answer engines and AI crawlers (same public paths as Googlebot).",
    ...AI_USER_AGENTS.flatMap((agent) => agentBlock(agent, disallows)),
    `Sitemap: ${site}/sitemap.xml`,
    `LLMs-Txt: ${site}/llms.txt`,
    `Host: nyumbasearch.com`,
  ].join("\n");
}
