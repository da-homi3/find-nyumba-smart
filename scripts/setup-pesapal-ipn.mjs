/**
 * Register Pesapal IPN URL and write PESAPAL_NOTIFICATION_ID to .env
 * Usage: node scripts/setup-pesapal-ipn.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");

function parseEnv(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let val = trimmed.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

function upsertEnv(key, value) {
  const original = readFileSync(envPath, "utf8");
  const lines = original.split("\n");
  let found = false;
  const out = lines.map((line) => {
    if (line.trim().startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) out.push(`${key}=${value}`);
  writeFileSync(envPath, out.join("\n").replace(/\n*$/, "\n"));
}

function apiBase(env) {
  return env.PESAPAL_ENV === "live"
    ? "https://pay.pesapal.com/v3/api"
    : "https://cybqa.pesapal.com/pesapalv3/api";
}

async function getAuthToken(env) {
  const res = await fetch(`${apiBase(env)}/Auth/RequestToken`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({
      consumer_key: env.PESAPAL_CONSUMER_KEY,
      consumer_secret: env.PESAPAL_CONSUMER_SECRET,
    }),
  });
  const data = await res.json();
  if (!data.token) {
    throw new Error(data.error?.message ?? data.message ?? "Pesapal auth failed");
  }
  return data.token;
}

async function registerIpnUrl(env, ipnUrl) {
  const token = await getAuthToken(env);
  const res = await fetch(`${apiBase(env)}/URLSetup/RegisterIPN`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: ipnUrl, ipn_notification_type: "POST" }),
  });
  const data = await res.json();
  if (!data.ipn_id) {
    throw new Error(data.error?.message ?? data.message ?? "IPN registration failed");
  }
  return data.ipn_id;
}

async function main() {
  if (!existsSync(envPath)) {
    console.error("Missing .env");
    process.exit(1);
  }

  const env = parseEnv(readFileSync(envPath, "utf8"));
  if (!env.PESAPAL_CONSUMER_KEY || !env.PESAPAL_CONSUMER_SECRET) {
    console.error("Set PESAPAL_CONSUMER_KEY and PESAPAL_CONSUMER_SECRET in .env first");
    process.exit(1);
  }

  const base = env.PUBLIC_APP_URL || env.SITE_URL || "https://nyumbasearch.com";
  const ipnUrl = `${base.replace(/\/$/, "")}/api/payments/webhook/pesapal`;

  console.log(`Registering IPN: ${ipnUrl}`);
  const ipnId = await registerIpnUrl(env, ipnUrl);
  console.log(`IPN ID: ${ipnId}`);

  upsertEnv("PESAPAL_NOTIFICATION_ID", ipnId);
  upsertEnv("VITE_PESAPAL_CHECKOUT_ENABLED", "1");
  console.log("Updated .env with PESAPAL_NOTIFICATION_ID");
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
