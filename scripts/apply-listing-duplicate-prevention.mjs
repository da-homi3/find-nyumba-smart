/**
 * Apply listing duplicate-prevention migration (fingerprint indexes) and
 * backfill duplicate_hash for existing active listings.
 * Usage: npm run db:migrate:dedupe
 *
 * NOTE: normalizeText/fingerprint below MUST match
 * src/lib/api/nyumba/listing-fingerprint.ts exactly.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function loadEnv() {
  const env = {};
  for (const path of [join(root, ".env")]) {
    if (!existsSync(path)) continue;
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

const MIGRATION_SQL = readFileSync(
  join(root, "supabase", "migrations", "20260708120000_listing_duplicate_prevention.sql"),
  "utf8",
);

function normalizeText(value) {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

async function computeFingerprint(row) {
  const composite = [
    normalizeText(row.title),
    normalizeText(row.neighborhood),
    normalizeText(row.property_type),
    String(row.bedrooms ?? 0),
    normalizeText(row.address ?? ""),
  ].join("|");
  const bytes = new TextEncoder().encode(composite);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function runManagementQuery(token, projectRef, query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Management API ${res.status}: ${body.slice(0, 500)}`);
  return body;
}

async function backfill(admin) {
  const pageSize = 500;
  let from = 0;
  let updated = 0;
  let collisions = 0;
  const seen = new Map();

  for (;;) {
    const { data: rows, error } = await admin
      .from("properties")
      .select(
        "id, title, neighborhood, property_type, bedrooms, address, duplicate_hash, created_at",
      )
      .eq("is_active", true)
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (!rows?.length) break;

    for (const row of rows) {
      const fingerprint = await computeFingerprint(row);
      if (seen.has(fingerprint)) {
        collisions += 1;
      } else {
        seen.set(fingerprint, row.id);
      }
      if (row.duplicate_hash !== fingerprint) {
        const { error: updateError } = await admin
          .from("properties")
          .update({ duplicate_hash: fingerprint })
          .eq("id", row.id);
        if (updateError) throw updateError;
        updated += 1;
      }
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return { updated, collisions };
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const token = env.SUPABASE_ACCESS_TOKEN;
  const projectRef = env.SUPABASE_PROJECT_REF;

  if (!url || !key) {
    console.error("Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  if (token && projectRef) {
    console.log("Applying listing duplicate-prevention migration…");
    await runManagementQuery(token, projectRef, MIGRATION_SQL);
    console.log("✓ Indexes ensured.");
  } else {
    console.log("Missing SUPABASE_ACCESS_TOKEN or SUPABASE_PROJECT_REF.");
    console.log("Paste this SQL in Supabase Dashboard → SQL Editor:\n");
    console.log(MIGRATION_SQL);
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  console.log("Backfilling duplicate_hash for active listings…");
  const { updated, collisions } = await backfill(admin);
  console.log(`✓ Backfill complete. Updated ${updated} listing(s).`);
  if (collisions > 0) {
    console.log(
      `⚠ ${collisions} existing active listing(s) share a fingerprint with an older listing (grandfathered; new duplicates will be blocked).`,
    );
  }
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
