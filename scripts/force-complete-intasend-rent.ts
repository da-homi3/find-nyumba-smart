/**
 * Settle pending IntaSend rent payments that are already COMPLETE at IntaSend.
 * Uses the same fulfillment path as production (via tsx).
 * Usage: npx tsx scripts/force-complete-intasend-rent.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { syncMpesaPaymentStatus } from "../src/lib/payments/complete-mpesa-payment";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env: Record<string, string> = {};
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
  Object.assign(process.env, env);
  return { ...env, ...process.env };
}

loadEnv();

const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

const { data: rows, error } = await admin
  .from("payments")
  .select("*")
  .eq("payment_type", "rent_payment")
  .eq("status", "pending")
  .not("mpesa_checkout_id", "is", null)
  .order("created_at", { ascending: false })
  .limit(20);

if (error) throw error;

for (const row of rows ?? []) {
  console.log("Syncing", row.id, row.mpesa_checkout_id);
  const synced = await syncMpesaPaymentStatus(admin as never, row as never);
  console.log("  →", synced.status, synced.mpesa_receipt);
}

console.log("Done");
