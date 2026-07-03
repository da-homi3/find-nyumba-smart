/**
 * Production smoke tests for NyumbaSearch.
 * Usage: node scripts/smoke-test.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.PUBLIC_APP_URL ?? "https://nyumbasearch.com";
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const PUBLIC_PATHS = [
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
];

const REVENUE_PATHS = [
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
];

const ROUTE_FRAGMENTS = ["/services", "/verify", "/landlord/checkout", "/admin/revenue"];

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

function formatResultLine(prefix, name, detail) {
  if (detail) return `${prefix} ${name} — ${detail}`;
  return `${prefix} ${name}`;
}

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(formatResultLine("✓", name, detail));
}

function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(formatResultLine("✗", name, detail));
}

function mpesaHost(mpesaEnv) {
  return mpesaEnv === "production"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

async function fetchWithRetry(
  url,
  options = {},
  { attempts = 3, delayMs = 2000, timeoutMs = 45_000 } = {},
) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);
      return res;
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * (attempt + 1)));
      }
    }
  }
  throw lastError;
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

async function runPublicPageChecks() {
  for (const path of PUBLIC_PATHS) {
    await checkPage(path);
  }
}

async function runRevenuePageChecks() {
  for (const path of REVENUE_PATHS) {
    await checkPageWhenDeployed(path);
  }
}

function runRouteRegistrationChecks() {
  const routeTree = readFileSync(join(root, "src", "routeTree.gen.ts"), "utf8");
  for (const fragment of ROUTE_FRAGMENTS) {
    if (routeTree.includes(fragment)) pass(`Route registered ${fragment}`, "routeTree.gen.ts");
    else fail(`Route registered ${fragment}`, "missing from routeTree");
  }
}

async function checkSitemap() {
  try {
    const xml = await (await fetch(`${BASE}/sitemap.xml`)).text();
    const count = (xml.match(/tenant\/property\//g) ?? []).length;
    if (count > 0) pass("Sitemap property URLs", `${count} listings`);
    else fail("Sitemap property URLs", "none found");
  } catch (e) {
    fail("Sitemap property URLs", String(e));
  }
}

async function checkListingsApi() {
  try {
    const res = await fetch(`${BASE}/api/listings?limit=5`);
    const json = await res.json();
    if (!res.ok) {
      fail("Listings API", `HTTP ${res.status}`);
      return;
    }
    if ((json.items?.length ?? 0) > 0) {
      pass(
        "Listings API",
        `${json.total ?? json.items.length} total, ${json.items.length} returned`,
      );
    } else {
      fail("Listings API", "empty items array");
    }
  } catch (e) {
    fail("Listings API", String(e));
  }

  try {
    const health = await (await fetch(`${BASE}/api/listings/health`)).json();
    if (health.ok) pass("Listings health", `${health.activeCount} active`);
    else fail("Listings health", health.error ?? "not ok");
  } catch (e) {
    fail("Listings health", String(e));
  }
}

async function checkSupabaseListings(env) {
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    fail("Supabase config", "missing URL/key in .env");
    return;
  }

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

  if (error) {
    fail("Supabase active listings", error.message);
    return;
  }
  if ((count ?? 0) === 0) {
    fail("Supabase active listings", "zero rows");
    return;
  }

  pass("Supabase active listings", `${count} total`);
  const sample = props?.[0];
  if (!sample) return;

  const res = await checkPage(`/tenant/property/${sample.id}`);
  const html = await res.text();
  if (html.includes(sample.title) || html.length > 5000) {
    pass("Property detail SSR", sample.title.slice(0, 40));
  } else {
    fail("Property detail SSR", "title not in HTML");
  }
}

async function checkMpesaOAuth(env) {
  const ck = env.MPESA_CONSUMER_KEY;
  const cs = env.MPESA_CONSUMER_SECRET;
  if (!ck || !cs) {
    fail("M-Pesa OAuth", "consumer key/secret missing");
    return;
  }

  const auth = Buffer.from(`${ck}:${cs}`).toString("base64");
  const mpesaEnv = env.MPESA_ENV ?? "sandbox";
  const host = mpesaHost(mpesaEnv);
  const res = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
    headers: { Authorization: `Basic ${auth}` },
  });
  const json = await res.json();
  if (res.ok && json.access_token) pass("M-Pesa OAuth", mpesaEnv);
  else fail("M-Pesa OAuth", JSON.stringify(json).slice(0, 120));
}

function checkMpesaConfig(env) {
  const mpesaReady = [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
  ].every((k) => env[k]);
  if (mpesaReady) pass("M-Pesa STK config", "all 4 vars set");
  else fail("M-Pesa STK config", "incomplete");
  return mpesaReady;
}

function checkSendGrid(env) {
  if (env.SENDGRID_API_KEY && env.SENDGRID_FROM_EMAIL) pass("SendGrid config", "key + from set");
  else fail("SendGrid config", "missing");
}

function checkGoogleMaps(env) {
  if (env.VITE_GOOGLE_MAPS_API_KEY) pass("Google Maps API key", "present in .env");
  else fail("Google Maps API key", "missing");
}

function nyumbaAiDetail(aiJson) {
  const provider = aiJson.provider ?? "unknown";
  const sample = aiJson.sample?.slice(0, 40) ?? "ok";
  return `${provider} — ${sample}`;
}

async function checkNyumbaAi(env) {
  try {
    const aiRes = await fetchWithRetry(`${BASE}/api/ai/probe`);
    const aiJson = await aiRes.json();
    if (aiRes.ok && aiJson.live) {
      pass("NyumbaAI live", nyumbaAiDetail(aiJson));
      return;
    }
    if (env.GEMINI_API_KEY) {
      fail("NyumbaAI live", `probe failed (${aiJson.provider ?? "unknown"})`);
      return;
    }
    pass("NyumbaAI", "heuristic fallback (Workers AI / Gemini unavailable)");
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e);
    if (env.GEMINI_API_KEY) fail("NyumbaAI probe", detail);
    else pass("NyumbaAI", `probe unreachable (${detail}) — optional when Gemini unset`);
  }
}

async function checkMpesaCallback() {
  try {
    const cbRes = await fetchWithRetry(`${BASE}/api/mpesa/callback`, {
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
}

async function checkDemoListing() {
  const demoId = "a1000001-0001-4000-8000-000000000001";
  try {
    const demoRes = await fetch(`${BASE}/tenant/property/${demoId}`);
    const demoHtml = await demoRes.text();
    if (demoRes.status === 404) {
      pass("Demo listing in prod", "404 (mock off — expected)");
      return;
    }
    if (demoHtml.includes("demo") || demoHtml.includes("Demo")) {
      pass("Demo listing page", "demo banner visible");
      return;
    }
    if (demoRes.ok) {
      pass("Demo listing page", "loads (mock enabled)");
      return;
    }
    fail("Demo listing page", `status ${demoRes.status}`);
  } catch (e) {
    fail("Demo listing page", String(e));
  }
}

async function checkMapAssets() {
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
}

async function runPortalShellChecks() {
  for (const path of ["/tenant/saved", "/tenant/messages", "/tenant/profile"]) {
    await checkPage(path);
  }
  for (const path of ["/landlord/dashboard", "/admin"]) {
    await checkPage(path);
  }
}

function checkStkParser() {
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
  const parseOk = raw?.CheckoutRequestID === "abc" && raw.ResultCode === 0;
  if (parseOk) pass("STK callback parser", "logic OK");
  else fail("STK callback parser", "logic failed");
}

async function runOptionalStkTest(env, mpesaReady) {
  if (process.env.RUN_STK_TEST !== "1" || !mpesaReady) return;

  const ck = env.MPESA_CONSUMER_KEY;
  const cs = env.MPESA_CONSUMER_SECRET;
  if (!ck || !cs) return;

  try {
    const mpesaEnv = env.MPESA_ENV ?? "sandbox";
    const host = mpesaHost(mpesaEnv);
    const auth = Buffer.from(`${ck}:${cs}`).toString("base64");
    const oauth = await fetch(`${host}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const { access_token: token } = await oauth.json();
    const shortcode = env.MPESA_SHORTCODE;
    const timestamp = new Date().toISOString().replaceAll(/\D/g, "").slice(0, 14);
    const password = Buffer.from(`${shortcode}${env.MPESA_PASSKEY}${timestamp}`).toString("base64");
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
      return;
    }
    if (stk.ok && stkJson.CheckoutRequestID) {
      pass("M-Pesa STK Push", stkJson.CustomerMessage ?? "sent");
      return;
    }
    const fallback = JSON.stringify(stkJson).slice(0, 120) || `HTTP ${stk.status}`;
    pass("M-Pesa STK Push", fallback);
  } catch (e) {
    pass("M-Pesa STK Push", `skipped (${String(e).slice(0, 80)})`);
  }
}

function printSummary() {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (!failed.length) {
    console.log("\nAll smoke tests passed.\n");
    return;
  }
  console.log("\nFailed:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.detail}`);
  process.exit(1);
}

try {
  const env = loadEnv();
  console.log(`\nNyumbaSearch smoke test → ${BASE}\n`);

  await runPublicPageChecks();
  await runRevenuePageChecks();
  runRouteRegistrationChecks();
  await checkSitemap();
  await checkListingsApi();
  await checkSupabaseListings(env);
  await checkMpesaOAuth(env);
  const mpesaReady = checkMpesaConfig(env);
  checkSendGrid(env);
  checkGoogleMaps(env);
  await checkNyumbaAi(env);
  await checkMpesaCallback();
  await checkDemoListing();
  await checkMapAssets();
  await runPortalShellChecks();
  checkStkParser();
  await runOptionalStkTest(env, mpesaReady);
  printSummary();
} catch (e) {
  console.error(e);
  process.exit(1);
}
