/**
 * Mark abandoned rent STK attempts failed (no checkout, or IntaSend still PENDING after 10+ min).
 * Usage: node scripts/cleanup-stale-rent-stk.mjs
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
const proxyUrl = `${env.SUPABASE_URL.replace(/\/$/, "")}/functions/v1/intasend-proxy`;
const proxySecret = env.INTASEND_PROXY_SECRET || env.CRON_SECRET;
const cutoff = Date.now() - 10 * 60 * 1000;

const { data: rows } = await admin
  .from("payments")
  .select("id,mpesa_checkout_id,created_at,metadata")
  .eq("payment_type", "rent_payment")
  .eq("status", "pending")
  .limit(30);

for (const row of rows || []) {
  const ageOk = new Date(row.created_at).getTime() < cutoff;
  if (!ageOk) continue;

  if (!row.mpesa_checkout_id) {
    await admin.from("payments").update({ status: "failed" }).eq("id", row.id);
    console.log("failed (no checkout)", row.id);
    continue;
  }

  const meta = row.metadata || {};
  if (meta.mpesaProvider === "daraja") continue;

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
  const data = await res.json().catch(() => ({}));
  const state = String(data?.invoice?.state || "").toUpperCase();
  if (state === "PENDING" || state === "PROCESSING" || !state) {
    await admin.from("payments").update({ status: "failed" }).eq("id", row.id);
    console.log("failed (stale STK)", row.id, row.mpesa_checkout_id, state || "unknown");
  }
}
console.log("Done");
