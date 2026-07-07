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

const content = [
  "User-agent: *",
  "Allow: /",
  ...staticRoutes.robotsDisallow.map((path) => `Disallow: ${path}`),
  "",
  `Sitemap: ${site}/sitemap.xml`,
  `LLMs-Txt: ${site}/llms.txt`,
].join("\n");

mkdirSync(join(root, "public"), { recursive: true });
writeFileSync(join(root, "public", "robots.txt"), content, "utf8");
console.log("Wrote public/robots.txt");
