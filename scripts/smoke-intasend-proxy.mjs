/**
 * Smoke-test the Supabase IntaSend proxy (wallets list).
 * Usage: node scripts/smoke-intasend-proxy.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = {};
  const path = join(root, ".env");
  if (existsSync(path)) {
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
  }
  return { ...env, ...process.env };
}

const env = loadEnv();
const base = (env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/$/, "");
const secret = env.INTASEND_PROXY_SECRET || env.CRON_SECRET;
const url = `${base}/functions/v1/intasend-proxy`;

const res = await fetch(url, {
  method: "POST",
  headers: {
    Authorization: `Bearer ${secret}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  body: JSON.stringify({ path: "/wallets/", method: "GET" }),
});
const text = await res.text();
console.log("proxy HTTP", res.status);
console.log(text.slice(0, 800));
