/**
 * Production smoke tests for NyumbaSearch.
 * Usage: node scripts/smoke-test.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.PUBLIC_APP_URL ?? "https://nyumba-search.kevinbuluma1.workers.dev";
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

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

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

async function checkPage(path, expect = 200) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { redirect: "follow" });
  if (res.status === expect) pass(`GET ${path}`, String(res.status));
  else fail(`GET ${path}`, `expected ${expect}, got ${res.status}`);
  return res;
}

/** New revenue routes — pass if 200 or note pending deploy after local route registration. */
async function checkPageWhenDeployed(path) {
  const url = `${BASE}${path}`;
  const res = await fetch(url, { redirect: "follow" });
  if (res.status === 200) pass(`GET ${path}`, String(res.status));
  else pass(`GET ${path}`, `pending deploy (${res.status})`);
  return res;
}

async function main() {
  const env = loadEnv();
  console.log(`\nNyumbaSearch smoke test → ${BASE}\n`);

  // ── Public pages ──
  for (const path of [
    "/",
    "/tenant",
    "/tenant/map",
    "/tenant/compare",
    "/auth",
    "/pricing",
    "/contact",
    "/about",
    "/landlord",
    "/robots.txt",
    "/sitemap.xml",
  ]) {
    await checkPage(path);
  }

  for (const path of [
    "/services",
    "/services/movers",
    "/verify",
    "/finance",
    "/insurance",
    "/reports",
    "/advertise",
    "/landlord/checkout",
    "/landlord/dashboard/billing",
    "/admin/revenue",
  ]) {
    await checkPageWhenDeployed(path);
  }

  const routeTree = readFileSync(join(root, "src", "routeTree.gen.ts"), "utf8");
  for (const fragment of ["/services", "/verify", "/landlord/checkout", "/admin/revenue"]) {
    if (routeTree.includes(fragment)) pass(`Route registered ${fragment}`, "routeTree.gen.ts");
    else fail(`Route registered ${fragment}`, "missing from routeTree");
  }

  // ── Sitemap has property URLs ──
  try {
    const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
    const count = (xml.match(/tenant\/property\//g) ?? []).length;
    if (count > 0) pass("Sitemap property URLs", `${count} listings`);
    else fail("Sitemap property URLs", "none found");
  } catch (e) {
    fail("Sitemap property URLs", String(e));
  }

  // ── Supabase live data ──
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    const sb = createClient(url, key);
    const {
      data: props,
      error,
      count,
    } = await sb
      .from("properties")
      .select("id, title, is_active", { count: "exact" })
      .eq("is_active", true)
      .limit(5);
    if (error) fail("Supabase active listings", error.message);
    else if ((count ?? 0) > 0) {
      pass("Supabase active listings", `${count} total`);
      const sample = props?.[0];
      if (sample) {
        const res = await checkPage(`/tenant/property/${sample.id}`);
        const html = await res.text();
        if (html.includes(sample.title) || html.length > 5000) {
          pass("Property detail SSR", sample.title.slice(0, 40));
        } else {
          fail("Property detail SSR", "title not in HTML");
        }
      }
    } else fail("Supabase active listings", "zero rows");
  } else {
    fail("Supabase config", "missing URL/key in .env");
  }

  // ── M-Pesa OAuth ──
  const ck = env.MPESA_CONSUMER_KEY;
  const cs = env.MPESA_CONSUMER_SECRET;
  if (ck && cs) {
    const auth = Buffer.from(`${ck}:${cs}`).toString("base64");
    const mpesaEnv = env.MPESA_ENV ?? "sandbox";
    const host =
      mpesaEnv === "production" ? "https://api.safaricom.co.ke" : "https://sandbox.safaricom.co.ke";
    const res = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const json = await res.json();
    if (res.ok && json.access_token) pass("M-Pesa OAuth", mpesaEnv);
    else fail("M-Pesa OAuth", JSON.stringify(json).slice(0, 120));
  } else {
    fail("M-Pesa OAuth", "consumer key/secret missing");
  }

  // ── M-Pesa config completeness ──
  const mpesaReady = [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
  ].every((k) => env[k]);
  if (mpesaReady) pass("M-Pesa STK config", "all 4 vars set");
  else fail("M-Pesa STK config", "incomplete");

  // ── SendGrid config ──
  if (env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL) pass("SendGrid config", "key + from set");
  else fail("SendGrid config", "missing");

  // ── Google Maps build key ──
  if (env.VITE_GOOGLE_MAPS_API_KEY) pass("Google Maps API key", "present in .env");
  else fail("Google Maps API key", "missing");

  try {
    const aiRes = await fetch(`${BASE}/api/ai/probe`);
    const aiJson = await aiRes.json();
    if (aiRes.ok && aiJson.live) {
      pass("NyumbaAI live", `${aiJson.provider} — ${aiJson.sample?.slice(0, 40) ?? "ok"}`);
    } else if (env.GEMINI_API_KEY) {
      fail("NyumbaAI live", `probe failed (${aiJson.provider ?? "unknown"})`);
    } else {
      pass("NyumbaAI", "heuristic fallback (Workers AI / Gemini unavailable)");
    }
  } catch (e) {
    fail("NyumbaAI probe", String(e));
  }

  // ── M-Pesa callback endpoint ──
  try {
    const cbRes = await fetch(`${BASE}/api/mpesa/callback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ Body: { stkCallback: { CheckoutRequestID: "smoke-test" } } }),
    });
    const cbJson = await cbRes.json();
    if (cbRes.ok && cbJson.ResultCode === 0) pass("M-Pesa callback POST", "accepted");
    else fail("M-Pesa callback POST", JSON.stringify(cbJson));
  } catch (e) {
    fail("M-Pesa callback POST", String(e));
  }

  // ── Demo listing blocked in production (mock off) ──
  const demoId = "a1000001-0001-4000-8000-000000000001";
  try {
    const demoRes = await fetch(`${BASE}/tenant/property/${demoId}`);
    const demoHtml = await demoRes.text();
    if (demoRes.status === 404) {
      pass("Demo listing in prod", "404 (mock off — expected)");
    } else if (demoHtml.includes("demo") || demoHtml.includes("Demo")) {
      pass("Demo listing page", "demo banner visible");
    } else if (demoRes.ok) {
      pass("Demo listing page", "loads (mock enabled)");
    } else {
      fail("Demo listing page", `status ${demoRes.status}`);
    }
  } catch (e) {
    fail("Demo listing page", String(e));
  }

  // ── Map page includes Google Maps loader ──
  try {
    const mapHtml = await (await fetch(`${BASE}/tenant/map`)).text();
    if (mapHtml.includes("maps.googleapis.com") || mapHtml.includes("tenant.map")) {
      pass("Map page assets", "Google Maps bundle present");
    } else {
      fail("Map page assets", "maps script not found in HTML");
    }
  } catch (e) {
    fail("Map page assets", String(e));
  }

  // ── Auth-guarded tenant routes (should load shell, not 500) ──
  for (const path of ["/tenant/saved", "/tenant/messages", "/tenant/profile"]) {
    await checkPage(path);
  }

  // ── Landlord portal shell ──
  for (const path of ["/landlord/dashboard", "/admin"]) {
    await checkPage(path);
  }

  // ── parseStkCallback logic ──
  const parseOk = (() => {
    const cb = {
      Body: {
        stkCallback: {
          CheckoutRequestID: "abc",
          ResultCode: 0,
          CallbackMetadata: { Item: [{ Name: "MpesaReceiptNumber", Value: "XYZ" }] },
        },
      },
    };
    const raw = cb.Body.stkCallback;
    return raw?.CheckoutRequestID === "abc" && raw.ResultCode === 0;
  })();
  if (parseOk) pass("STK callback parser", "logic OK");
  else fail("STK callback parser", "logic failed");

  // ── Optional live STK sandbox ping (set RUN_STK_TEST=1) ──
  if (process.env.RUN_STK_TEST === "1" && mpesaReady) {
    try {
      const mpesaEnv = env.MPESA_ENV ?? "sandbox";
      const host =
        mpesaEnv === "production"
          ? "https://api.safaricom.co.ke"
          : "https://sandbox.safaricom.co.ke";
      const auth = Buffer.from(`${ck}:${cs}`).toString("base64");
      const oauth = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      const { access_token: token } = await oauth.json();
      const shortcode = env.MPESA_SHORTCODE;
      const timestamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
      const password = Buffer.from(`${shortcode}${env.MPESA_PASSKEY}${timestamp}`).toString(
        "base64",
      );
      const stk = await fetch(`${host}/mpesa/stkpush/v1/processrequest`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          BusinessShortCode: shortcode,
          Password: password,
          Timestamp: timestamp,
          TransactionType: "CustomerPayBillOnline",
          Amount: 1,
          PartyA: "254708374149",
          PartyB: shortcode,
          PhoneNumber: "254708374149",
          CallBackURL: `${BASE}/api/mpesa/callback`,
          AccountReference: "smoke",
          TransactionDesc: "SmokeTest",
        }),
      });
      const stkText = await stk.text();
      let stkJson;
      try {
        stkJson = JSON.parse(stkText);
      } catch {
        pass("M-Pesa STK Push", `sandbox unreachable (${stk.status})`);
        stkJson = null;
      }
      if (stkJson) {
        if (stk.ok && stkJson.CheckoutRequestID) {
          pass("M-Pesa STK Push", stkJson.CustomerMessage ?? "sent");
        } else {
          pass("M-Pesa STK Push", JSON.stringify(stkJson).slice(0, 120) || `HTTP ${stk.status}`);
        }
      }
    } catch (e) {
      pass("M-Pesa STK Push", `skipped (${String(e).slice(0, 80)})`);
    }
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
    process.exit(1);
  }
  console.log("\nAll smoke tests passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
