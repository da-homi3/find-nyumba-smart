#!/usr/bin/env node
const SITE = (process.env.PUBLIC_APP_URL ?? "https://nyumbasearch.com").replace(/\/$/, "");
const UA =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36";

const routes = [
  "/",
  "/tenant",
  "/tenant/map",
  "/tenant/saved",
  "/auth",
  "/pricing",
  "/services",
  "/about",
];

async function check(path) {
  const url = `${SITE}${path}`;
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  const html = await res.text();
  const title = (html.match(/<title>([^<]*)<\/title>/i) ?? [])[1] ?? "";
  const hasViewport = /viewport-fit=cover/.test(html);
  const words = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
  const ok = res.ok && title.length > 0 && hasViewport;
  return { path, status: res.status, title, hasViewport, words, ok };
}

const results = await Promise.all(routes.map(check));
let failed = 0;
for (const r of results) {
  const mark = r.ok ? "✔" : "✖";
  console.log(`${mark} ${r.status} ${r.path} | ${r.title.slice(0, 60)} | words=${r.words}`);
  if (!r.ok) failed++;
}

if (failed > 0) {
  console.error(`\n${failed} Android smoke check(s) failed`);
  process.exit(1);
}
console.log("\nAndroid mobile browser smoke checks passed");
