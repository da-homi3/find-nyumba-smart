#!/usr/bin/env node
/** Write public/robots.txt from staticRoutes.json (mirrors src/lib/seo/robots.ts). */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const staticRoutes = JSON.parse(readFileSync(join(root, "src/lib/seo/staticRoutes.json"), "utf8"));

const site = (
  process.env.PUBLIC_APP_URL ??
  process.env.SITE_URL ??
  "https://nyumbasearch.com"
).replace(/\/$/, "");

function agentBlock(agent, disallows) {
  return [`User-agent: ${agent}`, "Allow: /", ...disallows.map((path) => `Disallow: ${path}`), ""];
}

const disallows = staticRoutes.robotsDisallow;
const aiAgents = staticRoutes.aiUserAgents ?? [];
const content = [
  "# NyumbaSearch crawl policy — public listings, areas, and services are indexable.",
  ...agentBlock("*", disallows),
  "# Answer engines and AI crawlers (same public paths as Googlebot).",
  ...aiAgents.flatMap((agent) => agentBlock(agent, disallows)),
  `Sitemap: ${site}/sitemap.xml`,
  `LLMs-Txt: ${site}/llms.txt`,
  "Host: nyumbasearch.com",
].join("\n");

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "robots.txt"), content, "utf8");
console.log("Wrote public/robots.txt");
