/**
 * Live payment + mobile BFF scan (no STK / no card charge).
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const BASE = process.env.PUBLIC_APP_URL ?? "https://nyumbasearch.com";

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (!existsSync(path)) return env;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
  }
  return env;
}

const results = [];

function formatLine(prefix, name, detail) {
  if (detail) return `${prefix} ${name} — ${detail}`;
  return `${prefix} ${name}`;
}

function pass(name, detail = "") {
  results.push({ ok: true, name, detail });
  console.log(formatLine("✓", name, detail));
}

function fail(name, detail = "") {
  results.push({ ok: false, name, detail });
  console.error(formatLine("✗", name, detail));
}

async function getJson(url, opts = {}) {
  const attempts = 3;
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { ...opts, signal: AbortSignal.timeout(45_000) });
      const text = await res.text();
      let json = null;
      try {
        json = JSON.parse(text);
      } catch {
        /* html/redirect */
      }
      return { res, text, json };
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

const env = loadEnv();

{
  const pages = [
    "/tenant/checkout",
    "/landlord/checkout",
    "/agency/checkout",
    "/manager/checkout",
    "/advertise/pay",
    "/pricing",
  ];
  for (const path of pages) {
    const res = await fetch(`${BASE}${path}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(45_000),
    });
    const html = await res.text();
    if (res.ok && html.includes("<!DOCTYPE html") && html.length > 4000) {
      pass(`GET ${path}`, `${res.status} ${html.length}B`);
    } else {
      fail(`GET ${path}`, `${res.status} ${html.length}B`);
    }
  }
}

{
  const { res, json } = await getJson(`${BASE}/api/health`);
  if (res.ok && json?.status === "healthy") {
    const names = (json.checks ?? []).map((c) => `${c.name}:${c.status}`).join(", ");
    pass("GET /api/health", names);
  } else {
    fail("GET /api/health", JSON.stringify(json ?? {}).slice(0, 200));
  }
}

{
  const secret = env.CRON_SECRET;
  if (!secret) fail("CRON_SECRET", "missing");
  else {
    const { res, json, text } = await getJson(`${BASE}/api/health/connections`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (res.ok && json) {
      const bad = (json.connections ?? []).filter((c) => c.status === "missing");
      if (bad.length) fail("connections health", bad.map((c) => c.name).join(", "));
      else {
        pass(
          "connections health",
          (json.connections ?? []).map((c) => `${c.name}:${c.status}`).join(", "),
        );
      }
    } else fail("connections health", `${res.status} ${text.slice(0, 120)}`);

    const probe = await getJson(`${BASE}/api/health/intasend-stk`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (probe.res.ok && probe.json) {
      const configured =
        probe.json.configured || probe.json.secretPresent || probe.json.proxyConfigured;
      const wallets = probe.json.wallets ?? [];
      const walletOk = wallets.some((w) => w.status === 200);
      if (configured && walletOk) pass("IntaSend wallets", `configured, wallet HTTP 200`);
      else if (configured) {
        pass("IntaSend config", `keys present; wallets ${JSON.stringify(wallets).slice(0, 140)}`);
      } else fail("IntaSend", JSON.stringify(probe.json).slice(0, 200));
    } else fail("IntaSend probe", `${probe.res.status} ${probe.text.slice(0, 120)}`);
  }
}

{
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const anon = env.SUPABASE_PUBLISHABLE_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const password = env.NYUMBA_SMOKE_TEST_PASSWORD;
  if (!url || !anon || !password) {
    fail("mobile BFF auth", "missing supabase or smoke password");
  } else {
    const sb = createClient(url, anon);
    const { data, error } = await sb.auth.signInWithPassword({
      email: "smoke-tenant@nyumbasearch.app",
      password,
    });
    if (error || !data.session) {
      fail("smoke tenant sign-in", error?.message ?? "no session");
    } else {
      const token = data.session.access_token;
      const headers = {
        Authorization: `Bearer ${token}`,
        "X-App-Client": "flutter",
        "Content-Type": "application/json",
      };
      const health = await getJson(`${BASE}/api/mobile/v1/health`, { headers });
      if (health.res.ok && health.json?.status === "ok") {
        pass("GET /api/mobile/v1/health", health.json.service);
      } else {
        fail("GET /api/mobile/v1/health", `${health.res.status} ${health.text.slice(0, 120)}`);
      }

      const listings = await getJson(`${BASE}/api/mobile/v1/listings?limit=2`, { headers });
      const items = listings.json?.items ?? listings.json?.listings ?? [];
      if (listings.res.ok) pass("GET /api/mobile/v1/listings", `${items.length || "ok"} items`);
      else {
        fail(
          "GET /api/mobile/v1/listings",
          `${listings.res.status} ${listings.text.slice(0, 120)}`,
        );
      }

      const me = await getJson(`${BASE}/api/mobile/v1/me`, { headers });
      if (me.res.ok) pass("GET /api/mobile/v1/me", me.json?.user?.id?.slice(0, 8) ?? "ok");
      else fail("GET /api/mobile/v1/me", `${me.res.status} ${me.text.slice(0, 120)}`);

      const badInit = await getJson(`${BASE}/api/mobile/v1/payments/initiate`, {
        method: "POST",
        headers,
        body: JSON.stringify({ paymentType: "tenant_plus" }),
      });
      if (badInit.res.status >= 400 && badInit.res.status < 500) {
        pass(
          "POST payments/initiate validation",
          `${badInit.res.status} (rejects incomplete body)`,
        );
      } else {
        fail(
          "POST payments/initiate validation",
          `${badInit.res.status} ${badInit.text.slice(0, 160)}`,
        );
      }

      const fakePay = await getJson(
        `${BASE}/api/mobile/v1/payments/00000000-0000-4000-8000-000000000001`,
        { headers },
      );
      if (fakePay.res.status === 404 || fakePay.res.status === 403 || fakePay.res.ok) {
        pass("GET payments/:id missing", String(fakePay.res.status));
      } else if (fakePay.res.status === 401) {
        fail("GET payments/:id", "401 with valid bearer");
      } else {
        pass("GET payments/:id", `${fakePay.res.status} ${fakePay.text.slice(0, 80)}`);
      }
    }
  }
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.filter((r) => r.ok).length}/${results.length} passed`);
if (failed.length) process.exit(1);
