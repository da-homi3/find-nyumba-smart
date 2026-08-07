/**
 * Inspect recent rent_payment rows + IntaSend status for pending ones.
 * Usage: node scripts/inspect-pending-rent-stk.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

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
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data, error } = await admin
  .from("payments")
  .select(
    "id,status,amount_kes,payment_type,payment_method,mpesa_checkout_id,mpesa_receipt,metadata,created_at",
  )
  .eq("payment_type", "rent_payment")
  .order("created_at", { ascending: false })
  .limit(10);

if (error) {
  console.error(error);
  process.exit(1);
}

console.log("=== Recent rent payments ===");
for (const row of data || []) {
  const meta = typeof row.metadata === "object" && row.metadata ? row.metadata : {};
  console.log(
    JSON.stringify({
      id: row.id,
      status: row.status,
      amount_kes: row.amount_kes,
      method: row.payment_method,
      checkout: row.mpesa_checkout_id,
      receipt: row.mpesa_receipt,
      provider: meta.mpesaProvider,
      invoiceId: meta.invoiceId,
      created_at: row.created_at,
    }),
  );
}

const pending = (data || []).filter((r) => r.status === "pending" && r.mpesa_checkout_id);
const proxyUrl = `${(env.SUPABASE_URL || "").replace(/\/$/, "")}/functions/v1/intasend-proxy`;
const proxySecret = env.INTASEND_PROXY_SECRET || env.CRON_SECRET;

for (const row of pending.slice(0, 3)) {
  console.log("\n=== IntaSend status for", row.mpesa_checkout_id, "===");
  const res = await fetch(proxyUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${proxySecret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      path: "/payment/status/",
      method: "POST",
      body: { invoice_id: row.mpesa_checkout_id },
    }),
  });
  console.log("HTTP", res.status, (await res.text()).slice(0, 800));
}
