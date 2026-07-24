/**
 * Sync server-side env from .env → Cloudflare Worker secrets + wrangler vars.
 * Usage: node scripts/sync-wrangler-env.mjs [--deploy]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { patchWorkerCron } from "./patch-worker-cron.mjs";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const wranglerConfig = join(root, "dist", "server", "wrangler.json");

const PRODUCTION_URL = "https://nyumbasearch.com";
const DEFAULT_CLOUDFLARE_ACCOUNT_ID = "7ff77105e5fd9fb5f560d381ec562ed8";

const CUSTOM_DOMAINS = ["nyumbasearch.com", "www.nyumbasearch.com"];

/** Plain vars merged into wrangler.json on deploy */
const VAR_KEYS = [
  "PUBLIC_APP_URL",
  "SITE_URL",
  "MPESA_ENV",
  "MPESA_SHORTCODE",
  "MPESA_CALLBACK_URL",
  "PESAPAL_ENV",
  "PESAPAL_CALLBACK_URL",
  "PESAPAL_NOTIFICATION_ID",
  "VITE_PESAPAL_CHECKOUT_ENABLED",
  "NYUMBA_USE_MOCK_LISTINGS",
  "GEMINI_MODEL",
  "NVIDIA_MODEL",
  "MAPBOX_PUBLIC_TOKEN",
  "VITE_MAPBOX_TOKEN",
  "WHATSAPP_API_VERSION",
  "OPS_ALERT_EMAIL",
];

/** Uploaded as Worker secrets */
const SECRET_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "OPS_NOTIFICATION_EMAIL",
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_PASSKEY",
  "MPESA_WEBHOOK_SECRET",
  "PESAPAL_CONSUMER_KEY",
  "PESAPAL_CONSUMER_SECRET",
  "CRON_SECRET",
  "GEMINI_API_KEY",
  "NVIDIA_API_KEY",
  "CARETAKER_SESSION_SECRET",
  "WHATSAPP_TOKEN",
  "WHATSAPP_VERIFY_TOKEN",
  "WHATSAPP_PHONE_ID",
  "WHATSAPP_APP_SECRET",
  "ANTHROPIC_API_KEY",
  "APILAYER_API_KEY",
  "MAILBOXLAYER_ACCESS_KEY",
  "NUMVERIFY_ACCESS_KEY",
  "IPSTACK_ACCESS_KEY",
  "STREETLAYER_ACCESS_KEY",
];

const DEPRECATED_ENV_KEYS = new Set([
  "LOVABLE_API_KEY",
  "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY",
  "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID",
]);

function parseEnvFile(text) {
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

function serializeEnvFile(env, originalText) {
  const lines = originalText.split("\n");
  const seen = new Set();
  const out = [];

  for (const line of lines) {
    const trimmed = line.trim();
    const m = trimmed.match(/^([^#=]+)=/);
    if (m && DEPRECATED_ENV_KEYS.has(m[1].trim())) {
      continue;
    }
    if (m && env[m[1].trim()] !== undefined) {
      const k = m[1].trim();
      out.push(`${k}=${env[k]}`);
      seen.add(k);
    } else {
      out.push(line);
    }
  }

  for (const [k, v] of Object.entries(env)) {
    if (!seen.has(k) && v) {
      out.push(`${k}=${v}`);
    }
  }

  return `${out.join("\n").trimEnd()}\n`;
}

function applyUrlDefaults(next) {
  if (!next.PUBLIC_APP_URL) next.PUBLIC_APP_URL = PRODUCTION_URL;
  if (!next.SITE_URL) next.SITE_URL = PRODUCTION_URL;
  if (!next.MPESA_CALLBACK_URL) {
    next.MPESA_CALLBACK_URL = `${next.PUBLIC_APP_URL}/api/mpesa/callback`;
  }
  if (!next.PESAPAL_CALLBACK_URL) {
    next.PESAPAL_CALLBACK_URL = `${next.PUBLIC_APP_URL}/api/payments/callback/card`;
  }
  if (!next.PESAPAL_ENV) next.PESAPAL_ENV = "sandbox";
  if (!next.VITE_SITE_URL) next.VITE_SITE_URL = next.PUBLIC_APP_URL;
}

function applyFeatureDefaults(next) {
  if (!next.NYUMBA_USE_MOCK_LISTINGS) next.NYUMBA_USE_MOCK_LISTINGS = "0";
  if (!next.CARETAKER_SESSION_SECRET) {
    next.CARETAKER_SESSION_SECRET = randomBytes(32).toString("hex");
  }
  if (!next.CRON_SECRET) {
    next.CRON_SECRET = randomBytes(24).toString("hex");
  }
  if (!next.MPESA_ENV && next.MPESA_CONSUMER_KEY) next.MPESA_ENV = "sandbox";
  if (next.PESAPAL_CONSUMER_KEY && next.PESAPAL_NOTIFICATION_ID) {
    next.VITE_PESAPAL_CHECKOUT_ENABLED = "1";
  }
}

function mirrorEnvKeys(next, pairs) {
  for (const [target, source] of pairs) {
    if (!next[target] && next[source]) next[target] = next[source];
  }
}

function removeDeprecatedKeys(next) {
  for (const key of DEPRECATED_ENV_KEYS) {
    delete next[key];
  }
}

function ensureDefaults(env) {
  const next = { ...env };
  applyUrlDefaults(next);
  applyFeatureDefaults(next);
  mirrorEnvKeys(next, [
    ["VITE_PESAPAL_CHECKOUT_ENABLED", "VITE_PESAPAL_CHECKOUT_ENABLED"],
    ["VITE_MAPBOX_TOKEN", "MAPBOX_PUBLIC_TOKEN"],
    ["MAPBOX_PUBLIC_TOKEN", "VITE_MAPBOX_TOKEN"],
    ["VITE_GOOGLE_MAPS_API_KEY", "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY"],
    ["VITE_GOOGLE_MAPS_TRACKING_ID", "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID"],
  ]);
  removeDeprecatedKeys(next);
  return next;
}

function putSecret(name, value) {
  execSync(`npx wrangler secret put ${name} --config "${wranglerConfig}"`, {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
    cwd: root,
  });
}

function getWranglerOAuthToken() {
  const candidates = [
    join(homedir(), ".config", ".wrangler", "config", "default.toml"),
    join(process.env.APPDATA ?? "", "xdg.config", ".wrangler", "config", "default.toml"),
  ];
  const configPath = candidates.find((p) => existsSync(p));
  if (!configPath) return null;
  const toml = readFileSync(configPath, "utf8");
  const oauthMatch = /oauth_token\s*=\s*"([^"]+)"/.exec(toml);
  return oauthMatch?.[1] ?? null;
}

async function hasCloudflareZone(domain) {
  const token = getWranglerOAuthToken();
  if (!token) return false;
  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/zones?name=${encodeURIComponent(domain)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const data = await res.json();
    return Boolean(data.success && data.result?.length);
  } catch {
    return false;
  }
}

function patchWranglerCustomDomains(zoneReady) {
  if (!existsSync(wranglerConfig)) {
    console.warn("Skip custom domains — run npm run build first.");
    return;
  }
  const cfg = JSON.parse(readFileSync(wranglerConfig, "utf8"));
  cfg.workers_dev = true;
  if (zoneReady) {
    cfg.routes = CUSTOM_DOMAINS.map((hostname) => ({
      pattern: hostname,
      custom_domain: true,
    }));
    console.log(`Patched custom domains: ${CUSTOM_DOMAINS.join(", ")}`);
  } else {
    delete cfg.routes;
    console.warn(
      "Skipping custom domains — add nyumbasearch.com in Cloudflare Dashboard → Add site, then: npm run deploy:domain",
    );
  }
  writeFileSync(wranglerConfig, JSON.stringify(cfg, null, 2));
}

function patchWranglerPaidPlan() {
  if (!existsSync(wranglerConfig)) return;
  const cfg = JSON.parse(readFileSync(wranglerConfig, "utf8"));
  cfg.compatibility_date = "2026-07-20";
  cfg.placement = { mode: "smart" };
  cfg.limits = { cpu_ms: 60_000, subrequests: 100_000 };
  cfg.observability = { enabled: true, head_sampling_rate: 1 };
  cfg.logpush = true;
  writeFileSync(wranglerConfig, JSON.stringify(cfg, null, 2));
  console.log(
    "Patched Workers Paid settings: Smart Placement, cpu_ms=60000, subrequests=100000, observability, logpush",
  );
}

function patchWranglerAccountId(env) {
  if (!existsSync(wranglerConfig)) return;
  const cfg = JSON.parse(readFileSync(wranglerConfig, "utf8"));
  cfg.account_id = env.CLOUDFLARE_ACCOUNT_ID || DEFAULT_CLOUDFLARE_ACCOUNT_ID;
  writeFileSync(wranglerConfig, JSON.stringify(cfg, null, 2));
  console.log(`Patched account_id → ${cfg.account_id}`);
}

function patchWranglerVars(env) {
  if (!existsSync(wranglerConfig)) {
    console.warn("Skip wrangler vars — run npm run build first.");
    return;
  }
  const cfg = JSON.parse(readFileSync(wranglerConfig, "utf8"));
  cfg.vars = cfg.vars ?? {};
  for (const key of VAR_KEYS) {
    if (env[key]) cfg.vars[key] = env[key];
  }
  cfg.ai = { binding: "AI" };
  cfg.kv_namespaces = [
    {
      binding: "CACHE_KV",
      id: "c0ce09d3f3344b028c5dfec6beaf7253",
    },
  ];
  cfg.durable_objects = {
    bindings: [{ name: "PRESENCE", class_name: "PresenceDurableObject" }],
  };
  cfg.migrations = [{ tag: "v1-presence", new_sqlite_classes: ["PresenceDurableObject"] }];
  writeFileSync(wranglerConfig, JSON.stringify(cfg, null, 2));
  console.log("Patched wrangler.json vars:", VAR_KEYS.filter((k) => env[k]).join(", "));
}

async function main() {
  if (!existsSync(envPath)) {
    console.error("Missing .env — copy from .env.example");
    process.exit(1);
  }

  const original = readFileSync(envPath, "utf8");
  let env = parseEnvFile(original);
  env = ensureDefaults(env);
  writeFileSync(envPath, serializeEnvFile(env, original));
  console.log("Updated .env defaults (PUBLIC_APP_URL, CARETAKER_SESSION_SECRET, etc.)");

  const missingMpesa = [
    "MPESA_CONSUMER_KEY",
    "MPESA_CONSUMER_SECRET",
    "MPESA_SHORTCODE",
    "MPESA_PASSKEY",
  ].filter((k) => !env[k]);
  if (missingMpesa.length) {
    console.warn(
      "M-Pesa not fully configured — add to .env from https://developer.safaricom.co.ke/:",
      missingMpesa.join(", "),
    );
    console.warn("Payments will stay in demo mode until these are set.");
  }

  if (!env.GEMINI_API_KEY) {
    console.log(
      "NyumbaAI: Cloudflare Workers AI on production (GEMINI_API_KEY optional for local dev).",
    );
  }

  const missingPesapal = [
    "PESAPAL_CONSUMER_KEY",
    "PESAPAL_CONSUMER_SECRET",
    "PESAPAL_NOTIFICATION_ID",
  ].filter((k) => !env[k]);
  if (missingPesapal.length) {
    console.warn(
      "Pesapal not fully configured — run: node scripts/setup-pesapal-ipn.mjs",
      missingPesapal.join(", "),
    );
  }

  if (!env.VITE_MAPBOX_TOKEN && !env.MAPBOX_PUBLIC_TOKEN) {
    console.warn(
      "Mapbox 3D map not configured — add VITE_MAPBOX_TOKEN (pk.ey...) from https://account.mapbox.com/access-tokens/",
    );
  }

  patchWranglerAccountId(env);
  patchWranglerVars(env);
  patchWranglerPaidPlan();
  const zoneReady = await hasCloudflareZone("nyumbasearch.com");
  patchWranglerCustomDomains(zoneReady);
  patchWorkerCron();

  if (process.argv.includes("--skip-secrets")) {
    console.log("\nSkipping Worker secret upload (--skip-secrets)");
  } else {
    console.log("\nUploading Worker secrets…");
    for (const key of SECRET_KEYS) {
      if (!env[key]) {
        console.log(`  skip ${key} (empty)`);
        continue;
      }
      console.log(`  put ${key}`);
      putSecret(key, env[key]);
    }
  }

  console.log("\nDone. Rebuild client for VITE_* keys: npm run build");
  if (process.argv.includes("--deploy")) {
    console.log("Deploying…");
    execSync(`npx wrangler deploy --config "${wranglerConfig}"`, {
      stdio: "inherit",
      cwd: root,
    });
  }
}

try {
  await main();
} catch (e) {
  console.error(e);
  process.exit(1);
}
