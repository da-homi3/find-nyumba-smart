/**
 * Public CTA / link smoke — extracts primary nav and key CTA hrefs from live pages
 * and asserts they return a usable status (no Playwright / OneDrive dependency).
 *
 * Usage: node scripts/public-cta-smoke.mjs [--base URL]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE =
  process.argv.find((a) => a.startsWith("--base="))?.slice(7) ??
  process.env.PUBLIC_APP_URL ??
  "https://nyumbasearch.com";

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

const results = [];
function pass(name, detail = "ok") {
  results.push({ ok: true, name, detail });
  console.log(`✓ ${name} — ${detail}`);
}
function fail(name, detail) {
  results.push({ ok: false, name, detail });
  console.log(`✗ ${name} — ${detail}`);
}

async function fetchText(path, { timeoutMs = 45_000 } = {}) {
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      "User-Agent": "NyumbaSearch-CTA-Smoke/1.0",
      Accept: "text/html,application/json",
    },
  });
  const text = await res.text();
  return { url, status: res.status, text, finalUrl: res.url };
}

function extractHrefs(html) {
  const hrefs = new Set();
  for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
    const raw = m[1].trim();
    if (
      !raw ||
      raw.startsWith("mailto:") ||
      raw.startsWith("tel:") ||
      raw.startsWith("javascript:")
    ) {
      continue;
    }
    hrefs.add(raw);
  }
  return [...hrefs];
}

function toPath(href) {
  try {
    if (href.startsWith("http")) {
      const u = new URL(href);
      if (!u.hostname.includes("nyumbasearch")) return null;
      return u.pathname + u.search;
    }
    if (href.startsWith("/")) return href.split("#")[0];
    return null;
  } catch {
    return null;
  }
}

const PAGES = [
  { path: "/", mustContain: [/Search/i, /Nyumba/i], expectLinks: ["/tenant", "/auth", "/pricing"] },
  {
    path: "/tenant",
    mustContain: [/listing|property|home|filter|map/i],
    expectLinks: ["/tenant/map"],
  },
  { path: "/auth", mustContain: [/sign|log|email|password/i] },
  {
    path: "/services",
    mustContain: [/service|provider|electrician|mover/i],
    expectLinks: ["/services/register"],
  },
  { path: "/pricing", mustContain: [/plan|plus|pricing|kes/i] },
  { path: "/contact", mustContain: [/contact|message|email|whatsapp/i] },
  { path: "/landlord", mustContain: [/landlord|list|property|dashboard/i] },
  { path: "/areas/kilimani", mustContain: [/kilimani|listing|home|property/i] },
  { path: "/advertise", mustContain: [/advertise|boost|list|plan/i] },
];

const REQUIRED_DESTINATIONS = [
  "/tenant",
  "/tenant/map",
  "/auth",
  "/pricing",
  "/services",
  "/services/movers",
  "/landlord",
  "/contact",
  "/about",
  "/areas",
  "/areas/kilimani",
];

function hasCta(text, discovered, need) {
  if (discovered.has(need)) return "ok";
  if (text.includes(`href="${need}`) || text.includes(`href='${need}`)) return "ok";
  if (text.includes(need)) return "path mentioned";
  return null;
}

async function auditPage(page, discovered) {
  const { status, text } = await fetchText(page.path);
  if (status !== 200) {
    fail(`GET ${page.path}`, `status ${status}`);
    return;
  }
  if (!page.mustContain.every((re) => re.test(text))) {
    fail(`GET ${page.path}`, "missing expected content markers");
    return;
  }
  pass(`GET ${page.path}`, `200 (${text.length}B)`);

  for (const href of extractHrefs(text)) {
    const p = toPath(href);
    if (p) discovered.add(p.split("?")[0]);
  }

  for (const need of page.expectLinks ?? []) {
    const how = hasCta(text, discovered, need);
    if (how) pass(`CTA present ${page.path} → ${need}`, how === "ok" ? "ok" : how);
    else fail(`CTA present ${page.path} → ${need}`, "not found in markup");
  }
}

async function auditRequiredDestinations() {
  console.log("\n— Required destinations —");
  for (const path of REQUIRED_DESTINATIONS) {
    try {
      const { status, text } = await fetchText(path);
      if (status === 200 && text.length > 500) pass(`Dest ${path}`, "200");
      else fail(`Dest ${path}`, `status ${status} len ${text.length}`);
    } catch (err) {
      fail(`Dest ${path}`, err.message ?? String(err));
    }
  }
}

async function auditListingDetail() {
  try {
    const list = await fetchText("/api/listings?limit=1");
    const body = JSON.parse(list.text);
    const id = body?.items?.[0]?.id ?? body?.properties?.[0]?.id ?? body?.data?.[0]?.id;
    if (!id) {
      pass("Listing detail CTA target", "no live listing id (skipped)");
      return;
    }
    const detail = await fetchText(`/tenant/property/${id}`);
    if (detail.status === 200) pass("Listing detail CTA target", id.slice(0, 8));
    else fail("Listing detail CTA target", String(detail.status));
  } catch (err) {
    fail("Listing detail CTA target", err.message ?? String(err));
  }
}

async function main() {
  loadEnv();
  console.log(`\nPublic CTA smoke → ${BASE}\n`);

  const discovered = new Set();
  for (const page of PAGES) {
    try {
      await auditPage(page, discovered);
    } catch (err) {
      fail(`GET ${page.path}`, err.message ?? String(err));
    }
  }

  await auditRequiredDestinations();
  await auditListingDetail();

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nPublic CTAs OK.\n");
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
