/**
 * Trigger Worker rent STK status sync via cron-auth endpoint.
 * Usage: node scripts/trigger-intasend-rent-sync.mjs
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
const base = (env.PUBLIC_APP_URL || env.SITE_URL || "https://nyumbasearch.com").replace(/\/$/, "");
const res = await fetch(`${base}/api/health/intasend-sync-rent`, {
  method: "POST",
  headers: { Authorization: `Bearer ${env.CRON_SECRET}`, Accept: "application/json" },
});
console.log("HTTP", res.status);
console.log(await res.text());
