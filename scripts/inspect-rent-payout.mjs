/**
 * Inspect fee ledger + payout status for the KES 19 rent payment.
 * Usage: node scripts/inspect-rent-payout.mjs
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

const SQL = `
SELECT p.id, p.amount, p.method, p.mpesa_receipt_number, p.paid_at, left(coalesce(p.note,''), 80) as note,
  f.id as fee_id, f.gross_amount, f.platform_fee, f.net_payout_amount, f.payout_batch_id,
  b.id as batch_id, b.status as batch_status, b.total_net_payout, b.total_platform_fee,
  b.provider_ref, b.failure_reason
FROM pm_rent_payments p
LEFT JOIN pm_platform_fee_ledger f ON f.rent_payment_id = p.id
LEFT JOIN pm_payout_batches b ON b.id = f.payout_batch_id
WHERE p.amount = 19
   OR p.mpesa_receipt_number = 'UH4M7205GV'
   OR p.note ILIKE '%4C1AD6371E%'
ORDER BY p.paid_at DESC NULLS LAST
LIMIT 10;
`;

const DEST_SQL = `
SELECT id, owner_user_id, destination_type, verified, is_active, property_id, deleted_at,
  left(coalesce(mpesa_phone,''), 20) as mpesa_phone,
  left(coalesce(mpesa_paybill_number,''), 20) as paybill,
  left(coalesce(mpesa_till_number,''), 20) as till,
  left(coalesce(bank_account_number,''), 20) as bank_acct
FROM pm_payout_destinations
WHERE owner_user_id = '9d7b70a5-a1e8-462e-9d01-edee9bece857'
ORDER BY created_at DESC
LIMIT 30;
`;

const OWNER_SQL = `
SELECT p.id as payment_id, prop.id as property_id, prop.name, prop.owner_user_id,
  pr.full_name as owner_name
FROM pm_rent_payments p
JOIN pm_rent_invoices inv ON inv.id = p.invoice_id
JOIN pm_leases l ON l.id = inv.lease_id
JOIN pm_units u ON u.id = l.unit_id
JOIN pm_properties prop ON prop.id = u.property_id
LEFT JOIN profiles pr ON pr.id = prop.owner_user_id
WHERE p.id = '4c1ad637-1e19-4891-92f6-c0fe23006d8c';
`;

async function runQuery(token, projectRef, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${body.slice(0, 500)}`);
  return body;
}

const env = loadEnv();
const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef = env.SUPABASE_PROJECT_REF;
if (!token || !projectRef) {
  console.error("Need SUPABASE_ACCESS_TOKEN and SUPABASE_PROJECT_REF");
  process.exit(1);
}

console.log("=== Rent payment + fee/payout ===");
console.log(await runQuery(token, projectRef, SQL));
console.log("\n=== Owner for KES 19 payment ===");
console.log(await runQuery(token, projectRef, OWNER_SQL));
console.log("\n=== Payout destinations ===");
console.log(await runQuery(token, projectRef, DEST_SQL));
console.log(
  "\nINTASEND_SECRET_KEY set?",
  Boolean(env.INTASEND_SECRET_KEY && env.INTASEND_SECRET_KEY.length > 8),
);
