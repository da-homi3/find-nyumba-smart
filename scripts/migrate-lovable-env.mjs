/**
 * Migrate deprecated Lovable env vars to first-party names and remove Lovable keys.
 * Usage: node scripts/migrate-lovable-env.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");
const PRODUCTION_URL = "https://nyumba-search.kevinbuluma1.workers.dev";

const DEPRECATED = new Set([
  "LOVABLE_API_KEY",
  "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY",
  "VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID",
]);

function parse(text) {
  const env = {};
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
  return env;
}

function serialize(env, original) {
  const out = [];
  const seen = new Set();
  for (const line of original.split("\n")) {
    const t = line.trim();
    const m = t.match(/^([^#=]+)=/);
    if (m && DEPRECATED.has(m[1].trim())) continue;
    if (m && env[m[1].trim()] !== undefined) {
      const k = m[1].trim();
      out.push(`${k}=${env[k]}`);
      seen.add(k);
    } else {
      out.push(line);
    }
  }
  for (const [k, v] of Object.entries(env)) {
    if (!seen.has(k) && v) out.push(`${k}=${v}`);
  }
  return out.join("\n").replace(/\n*$/, "\n");
}

if (!existsSync(envPath)) {
  console.error("No .env file");
  process.exit(1);
}

const original = readFileSync(envPath, "utf8");
const env = parse(original);

if (!env.PUBLIC_APP_URL) env.PUBLIC_APP_URL = PRODUCTION_URL;
if (!env.SITE_URL) env.SITE_URL = env.PUBLIC_APP_URL;
if (!env.VITE_SITE_URL) env.VITE_SITE_URL = env.PUBLIC_APP_URL;
if (!env.VITE_GOOGLE_MAPS_API_KEY && env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY) {
  env.VITE_GOOGLE_MAPS_API_KEY = env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY;
}
if (!env.VITE_GOOGLE_MAPS_TRACKING_ID && env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID) {
  env.VITE_GOOGLE_MAPS_TRACKING_ID = env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID;
}
for (const key of DEPRECATED) delete env[key];

writeFileSync(envPath, serialize(env, original), "utf8");
console.log("✓ Migrated .env: removed Lovable keys, kept VITE_GOOGLE_MAPS_* and site URLs.");
