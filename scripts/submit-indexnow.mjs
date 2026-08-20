#!/usr/bin/env node
/**
 * Notify IndexNow (Bing, Yandex, Seznam, Naver, …) about public URLs.
 * Google does not use IndexNow — GSC Validate Fix still needs a Google login.
 *
 * Usage: node scripts/submit-indexnow.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const KEY = "eadbba7a0a778ba26d383e00d30c2784";
const SITE = (
  process.env.PUBLIC_APP_URL ??
  process.env.SITE_URL ??
  "https://nyumbasearch.com"
).replace(/\/$/, "");

const staticRoutes = JSON.parse(
  readFileSync(join(root, "src/lib/seo/staticRoutes.json"), "utf8"),
);

function priorityUrls() {
  const marketing = (staticRoutes.sitemapPaths ?? []).filter(
    (path) => path !== "/areas" && !String(path).startsWith("/areas/"),
  );
  const areas = [
    "/areas",
    ...(staticRoutes.geoAreas ?? []).map((area) => `/areas/${area.slug}`),
  ];
  const services = (staticRoutes.serviceCategories ?? [])
    .slice(0, 12)
    .map((slug) => `/services/${slug}`);
  const paths = ["", ...marketing, ...areas, ...services];
  return [...new Set(paths.map((path) => `${SITE}${path || ""}`))];
}

function urlsFromSitemap() {
  const file = join(root, "public", "sitemap.xml");
  if (!existsSync(file)) return [];
  const xml = readFileSync(file, "utf8");
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  // Cap property flood — IndexNow is for changes, not full dumps.
  const staticish = locs.filter((u) => !u.includes("/tenant/property/"));
  const properties = locs.filter((u) => u.includes("/tenant/property/")).slice(0, 40);
  return [...staticish, ...properties];
}

const urlList = [...new Set([...priorityUrls(), ...urlsFromSitemap()])].slice(0, 200);
const keyLocation = `${SITE}/${KEY}.txt`;

const keyRes = await fetch(keyLocation);
if (!keyRes.ok) {
  console.error(`Key file not reachable at ${keyLocation} (${keyRes.status}). Deploy first.`);
  process.exit(1);
}
const keyBody = (await keyRes.text()).trim();
if (keyBody !== KEY) {
  console.error(`Key file mismatch at ${keyLocation}`);
  process.exit(1);
}

const payload = {
  host: new URL(SITE).host,
  key: KEY,
  keyLocation,
  urlList,
};

const endpoints = [
  "https://api.indexnow.org/indexnow",
  "https://www.bing.com/indexnow",
];

let ok = 0;
for (const endpoint of endpoints) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  });
  const text = await res.text().catch(() => "");
  console.log(`${endpoint} → ${res.status} ${text.slice(0, 120)}`);
  if (res.status === 200 || res.status === 202) ok++;
}

console.log(`Submitted ${urlList.length} URLs (${ok}/${endpoints.length} endpoints accepted)`);
if (ok === 0) process.exit(1);
