/**
 * Smoke-test the public surface after a deploy. Checks that pages render and, crucially,
 * that listing data still reaches the page (the column grants changed under it).
 *
 * Usage: node scripts/smoke-public.mjs [baseUrl]
 */
const base = process.argv[2] ?? "https://nyumbasearch.com";

const PAGES = [
  { path: "/", expect: /nyumba/i },
  { path: "/tenant", expect: /nyumba/i },
  { path: "/sitemap.xml", expect: /<urlset/i },
  { path: "/robots.txt", expect: /User-agent/i },
];

let failures = 0;

for (const { path, expect } of PAGES) {
  try {
    const res = await fetch(base + path, { headers: { "User-Agent": "nyumba-smoke/1.0" } });
    const body = await res.text();
    const ok = res.ok && expect.test(body);
    if (!ok) failures += 1;
    console.log(
      `${ok ? "ok  " : "FAIL"}  ${path} -> ${res.status} (${body.length} bytes)` +
        (res.ok && !expect.test(body) ? "  [content check failed]" : ""),
    );
  } catch (e) {
    failures += 1;
    console.log(`FAIL  ${path} -> ${e.message}`);
  }
}

// The browse page is server-rendered from the anon Supabase client, so a broken column
// grant would show up as an empty listing grid rather than an HTTP error.
try {
  const res = await fetch(`${base}/tenant`, { headers: { "User-Agent": "nyumba-smoke/1.0" } });
  const html = await res.text();
  const hasListings = /property|listing|bedroom|KES/i.test(html);
  if (!hasListings) failures += 1;
  console.log(`${hasListings ? "ok  " : "FAIL"}  /tenant renders listing content`);
} catch (e) {
  failures += 1;
  console.log(`FAIL  listing content -> ${e.message}`);
}

console.log(failures === 0 ? "\nSmoke passed." : `\n${failures} smoke check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
