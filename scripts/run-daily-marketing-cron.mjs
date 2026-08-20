import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = join(root, ".env");

function loadEnv() {
  const env = {};
  if (!existsSync(envPath)) throw new Error("Missing .env");
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
  }
  return env;
}

const env = loadEnv();
const secret = env.CRON_SECRET;
const base = (env.PUBLIC_APP_URL ?? "https://nyumbasearch.com").replace(/\/$/, "");
if (!secret) {
  console.error("Need CRON_SECRET in .env");
  process.exit(1);
}

const path = process.argv[2] ?? "/api/cron/subscription-invoices";
const res = await fetch(`${base}${path}`, {
  method: "POST",
  headers: { authorization: `Bearer ${secret}` },
});
const text = await res.text();
console.log(res.status, text.slice(0, 2500));
if (!res.ok) process.exit(1);
