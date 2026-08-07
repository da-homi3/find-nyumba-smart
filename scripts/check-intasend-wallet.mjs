/**
 * List IntaSend wallets + balances (no secrets printed).
 * Usage: node scripts/check-intasend-wallet.mjs
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
const key = env.INTASEND_SECRET_KEY;
if (!key) {
  console.error("INTASEND_SECRET_KEY missing");
  process.exit(1);
}

const bases =
  (env.INTASEND_ENV || "live").toLowerCase() === "sandbox"
    ? ["https://sandbox.intasend.com/api/v1"]
    : ["https://payment.intasend.com/api/v1", "https://api.intasend.com/api/v1"];

for (const base of bases) {
  const res = await fetch(`${base}/wallets/`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }
  let rows = [];
  if (Array.isArray(data)) {
    rows = data;
  } else if (Array.isArray(data?.results)) {
    rows = data.results;
  } else if (Array.isArray(data?.wallets)) {
    rows = data.wallets;
  }
  console.log("BASE", base, "HTTP", res.status, "wallets", rows.length);
  for (const w of rows) {
    console.log(
      JSON.stringify({
        wallet_id: w.wallet_id || w.id,
        currency: w.currency,
        type: w.wallet_type,
        can_disburse: w.can_disburse,
        current: w.current_balance,
        available: w.available_balance,
        label: w.label,
      }),
    );
  }
  if (!rows.length && text) console.log(text.slice(0, 400));
}
