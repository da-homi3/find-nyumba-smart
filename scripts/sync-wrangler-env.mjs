/**
 * Sync server-side env from .env → Cloudflare Worker secrets + wrangler vars.
 * Usage: node scripts/sync-wrangler-env.mjs [--deploy]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const envPath = join(root, ".env");
const wranglerConfig = join(root, "dist", "server", "wrangler.json");

const PRODUCTION_URL = "https://nyumba-search.kevinbuluma1.workers.dev";

/** Plain vars merged into wrangler.json on deploy */
const VAR_KEYS = [
  "PUBLIC_APP_URL",
  "SITE_URL",
  "MPESA_ENV",
  "MPESA_CALLBACK_URL",
  "NYUMBA_USE_MOCK_LISTINGS",
  "GEMINI_MODEL",
];

/** Uploaded as Worker secrets */
const SECRET_KEYS = [
  "SUPABASE_SERVICE_ROLE_KEY",
  "SENDGRID_API_KEY",
  "SENDGRID_FROM_EMAIL",
  "OPS_NOTIFICATION_EMAIL",
  "MPESA_CONSUMER_KEY",
  "MPESA_CONSUMER_SECRET",
  "MPESA_SHORTCODE",
  "MPESA_PASSKEY",
  "GEMINI_API_KEY",
  "CARETAKER_SESSION_SECRET",
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

  return out.join("\n").replace(/\n*$/, "\n");
}

function ensureDefaults(env) {
  const next = { ...env };

  if (!next.PUBLIC_APP_URL) next.PUBLIC_APP_URL = PRODUCTION_URL;
  if (!next.SITE_URL) next.SITE_URL = PRODUCTION_URL;
  if (!next.MPESA_CALLBACK_URL) {
    next.MPESA_CALLBACK_URL = `${next.PUBLIC_APP_URL}/api/mpesa/callback`;
  }
  if (!next.NYUMBA_USE_MOCK_LISTINGS) next.NYUMBA_USE_MOCK_LISTINGS = "0";
  if (!next.CARETAKER_SESSION_SECRET) {
    next.CARETAKER_SESSION_SECRET = randomBytes(32).toString("hex");
  }
  if (!next.MPESA_ENV && next.MPESA_CONSUMER_KEY) next.MPESA_ENV = "sandbox";
  if (!next.VITE_SITE_URL) next.VITE_SITE_URL = next.PUBLIC_APP_URL;

  if (!next.VITE_GOOGLE_MAPS_API_KEY && next.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY) {
    next.VITE_GOOGLE_MAPS_API_KEY = next.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
  }
  if (!next.VITE_GOOGLE_MAPS_TRACKING_ID && next.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID) {
    next.VITE_GOOGLE_MAPS_TRACKING_ID = next.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
  }

  for (const key of DEPRECATED_ENV_KEYS) {
    delete next[key];
  }

  return next;
}

function putSecret(name, value) {
  execSync(`npx wrangler secret put ${name} --config "${wranglerConfig}"`, {
    input: value,
    stdio: ["pipe", "inherit", "inherit"],
    cwd: root,
  });
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
  writeFileSync(wranglerConfig, JSON.stringify(cfg, null, 2));
  console.log("Patched wrangler.json vars:", VAR_KEYS.filter((k) => env[k]).join(", "));
}

function main() {
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

  console.log("\nUploading Worker secrets…");
  for (const key of SECRET_KEYS) {
    if (!env[key]) {
      console.log(`  skip ${key} (empty)`);
      continue;
    }
    console.log(`  put ${key}`);
    putSecret(key, env[key]);
  }

  patchWranglerVars(env);

  console.log("\nDone. Rebuild client for VITE_* keys: npm run build");
  if (process.argv.includes("--deploy")) {
    console.log("Deploying…");
    execSync(`npx wrangler deploy --config "${wranglerConfig}"`, {
      stdio: "inherit",
      cwd: root,
    });
  }
}

main();
