/**
 * Probe IntaSend STK from the live Worker (same egress as rent payments).
 * Usage: node scripts/probe-intasend-worker.mjs
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
const secret = env.CRON_SECRET;
const base = (env.PUBLIC_APP_URL || env.SITE_URL || "https://nyumbasearch.com").replace(/\/$/, "");
if (!secret) {
  console.error("CRON_SECRET missing");
  process.exit(1);
}

const url = `${base}/api/health/intasend-stk`;
const res = await fetch(url, {
  headers: { Authorization: `Bearer ${secret}`, Accept: "application/json" },
});
const text = await res.text();
console.log("HTTP", res.status);
console.log(text.slice(0, 2000));
