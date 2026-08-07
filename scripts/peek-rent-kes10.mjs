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
const e = loadEnv();
const a = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const invoiceId = "566374d1-adb9-4eef-bf5a-5c0dd3d5a25d";
console.log(
  "inv",
  await a.from("pm_rent_invoices").select("id,amount_due,amount_paid,status").eq("id", invoiceId),
);
console.log(
  "pay",
  await a
    .from("payments")
    .select("id,status,mpesa_receipt,metadata,amount_kes")
    .eq("id", "f6678429-ff4a-4b80-9f32-d2d7692e000b")
    .single(),
);
console.log(
  "rent pays",
  await a
    .from("pm_rent_payments")
    .select("id,amount,payment_id,mpesa_receipt_number,invoice_id,paid_at")
    .eq("invoice_id", invoiceId)
    .limit(10),
);
console.log(
  "by payment_id",
  await a
    .from("pm_rent_payments")
    .select("id,amount,payment_id,mpesa_receipt_number")
    .eq("payment_id", "f6678429-ff4a-4b80-9f32-d2d7692e000b"),
);
