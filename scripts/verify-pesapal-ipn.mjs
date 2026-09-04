/**
 * Verify Pesapal IPN auth on production (or PUBLIC_APP_URL).
 * Usage: node scripts/verify-pesapal-ipn.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

function loadEnv() {
  const env = { ...process.env };
  if (!existsSync(envPath)) return env;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    const key = t.slice(0, eq).trim();
    if (env[key] == null || env[key] === "") env[key] = v;
  }
  return env;
}

const env = loadEnv();
const base = (env.PUBLIC_APP_URL || env.SITE_URL || "https://nyumbasearch.com").replace(/\/$/, "");
const secret = env.PESAPAL_WEBHOOK_SECRET?.trim();
const ipnUrl = `${base}/api/payments/webhook/pesapal`;

async function status(url, init) {
  const res = await fetch(url, init);
  return res.status;
}

const noSecret = await status(ipnUrl);
const withSecret = secret ? await status(`${ipnUrl}?secret=${encodeURIComponent(secret)}`) : null;

console.log(`IPN URL: ${ipnUrl}`);
console.log(`PESAPAL_NOTIFICATION_ID: ${env.PESAPAL_NOTIFICATION_ID ? "set" : "missing"}`);
console.log(`PESAPAL_WEBHOOK_SECRET: ${secret ? "set" : "missing"}`);
console.log(`No secret → HTTP ${noSecret} (expect 401 in live)`);
if (withSecret != null) {
  console.log(`With secret → HTTP ${withSecret} (expect 400 missing OrderTrackingId)`);
}

const ok =
  noSecret === 401 &&
  (withSecret == null || withSecret === 400) &&
  Boolean(env.PESAPAL_NOTIFICATION_ID) &&
  Boolean(secret);

if (!secret) {
  if (noSecret === 401) {
    console.log("✓ Pesapal rejects unsigned IPN (full verify skipped — no webhook secret in env)");
    process.exit(0);
  }
  console.error("Pesapal IPN verification failed — unsigned IPN not rejected");
  process.exit(1);
}

if (!ok) {
  console.error("Pesapal IPN verification failed — run: node scripts/setup-pesapal-ipn.mjs");
  process.exit(1);
}
console.log("✓ Pesapal IPN auth looks correct");
