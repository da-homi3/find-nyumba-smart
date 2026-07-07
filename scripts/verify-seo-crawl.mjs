#!/usr/bin/env node
/**
 * Phase 3 SEO crawlability check — verifies SSR HTML is distinct per route.
 * Usage: npm run verify:seo-crawl
 */
const SITE = (process.env.PUBLIC_APP_URL ?? "https://nyumbasearch.com").replace(/\/$/, "");
const INNER = `${SITE}/about`;

const UA = "Googlebot/2.1 (+http://www.google.com/bot.html)";

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return res.text();
}

function extractTitle(html) {
  const match = html.match(/<title>([^<]*)<\/title>/i);
  return match?.[1] ?? "";
}

function visibleWordCount(html) {
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text ? text.split(" ").length : 0;
}

function hasSubstantialBody(html) {
  return !/<div id="root">\s*<\/div>/i.test(html) && visibleWordCount(html) > 80;
}

const [homeHtml, innerHtml] = await Promise.all([fetchHtml(SITE), fetchHtml(INNER)]);

const homeTitle = extractTitle(homeHtml);
const innerTitle = extractTitle(innerHtml);
const identical = homeHtml === innerHtml;

const checks = [
  { name: "distinct HTML per route", ok: !identical },
  { name: "distinct titles per route", ok: homeTitle && innerTitle && homeTitle !== innerTitle },
  { name: "homepage substantial SSR body", ok: hasSubstantialBody(homeHtml) },
  { name: "inner page substantial SSR body", ok: hasSubstantialBody(innerHtml) },
  { name: "homepage has canonical", ok: homeHtml.includes('rel="canonical"') },
  { name: "inner page has canonical", ok: innerHtml.includes('rel="canonical"') },
];

let failed = 0;
for (const check of checks) {
  const status = check.ok ? "✔" : "✖";
  console.log(`${status} ${check.name}`);
  if (!check.ok) failed++;
}

console.log(`\nHome title: ${homeTitle}`);
console.log(`About title: ${innerTitle}`);
console.log(
  `Home words: ${visibleWordCount(homeHtml)} | About words: ${visibleWordCount(innerHtml)}`,
);

if (failed > 0) {
  console.error(`\n${failed} SEO crawl check(s) failed`);
  process.exit(1);
}
console.log("\nSEO crawl checks passed (TanStack Start SSR — no prerender needed)");
