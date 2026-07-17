/**
 * Permanently delete specific seeded sample listings by title match.
 * Usage: node scripts/delete-named-sample-listings.mjs [--dry-run]
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dryRun = process.argv.includes("--dry-run");

/** Exact titles from the admin Moderate listings screenshots. */
const EXACT_TITLES = [
  "1BR Apartment, Furnished",
  "Student Hostel Single",
  "Executive Maisonette",
  "Two Bedroom — Kileleshwa",
  "Tumaini Rongai — 2BR near stage (walkthrough)",
  "Tumaini Rongai walkthrough — 2BR near stage",
  "Studio Apt — No Agent Fee",
  "Affordable Single Room",
  "Modern 1BR — South B",
  "3BR Family Flat — South B",
  "Cosy Bedsitter near Yaya Centre",
  "Modern 2BR with City Views",
  "Bedsitter — Ruaka Town",
  "Affordable 2BR — Rongai",
];

/** Extra fuzzy stems in case punctuation differs slightly. */
const TITLE_STEMS = [
  "1BR Apartment, Furnished",
  "Student Hostel Single",
  "Executive Maisonette",
  "Two Bedroom",
  "Tumaini Rongai",
  "Studio Apt — No Agent Fee",
  "Studio Apt - No Agent Fee",
  "Affordable Single Room",
  "Modern 1BR — South B",
  "Modern 1BR - South B",
  "3BR Family Flat",
  "Cosy Bedsitter near Yaya",
  "Modern 2BR with City Views",
  "Bedsitter — Ruaka",
  "Bedsitter - Ruaka",
  "Affordable 2BR — Rongai",
  "Affordable 2BR - Rongai",
];

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

function normalizeTitle(title) {
  return title
    .toLowerCase()
    .replaceAll("—", "-")
    .replaceAll("–", "-")
    .replaceAll(/\s+/g, " ")
    .trim();
}

function isTargetListing(title) {
  const n = normalizeTitle(title ?? "");
  if (EXACT_TITLES.some((t) => normalizeTitle(t) === n)) return true;
  return TITLE_STEMS.some((stem) => n.includes(normalizeTitle(stem)));
}

async function deleteRelated(admin, ids) {
  const attempts = [
    ["contact_unlocks", "listing_id"],
    ["saved_properties", "property_id"],
    ["property_reports", "property_id"],
    ["property_reviews", "property_id"],
    ["viewings", "property_id"],
    ["inquiries", "property_id"],
    ["payments", "property_id"],
    ["listing_boosts", "listing_id"],
  ];
  for (const [table, col] of attempts) {
    try {
      const { error } = await admin.from(table).delete().in(col, ids);
      if (error && !/column|schema cache|does not exist/i.test(error.message)) {
        console.warn(`  warn ${table}.${col}:`, error.message);
      }
    } catch (e) {
      console.warn(`  warn ${table}:`, e.message ?? e);
    }
  }
  // inquiry_messages via inquiries already removed if cascade; best-effort otherwise
  try {
    const { data: inquiries } = await admin.from("inquiries").select("id").in("property_id", ids);
    const inquiryIds = (inquiries ?? []).map((r) => r.id);
    if (inquiryIds.length) {
      await admin.from("inquiry_messages").delete().in("inquiry_id", inquiryIds);
      await admin.from("inquiries").delete().in("id", inquiryIds);
    }
  } catch {
    // ignore
  }
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required");

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await admin
    .from("properties")
    .select("id, title, neighborhood, is_active, is_verified")
    .limit(5000);
  if (error) throw error;

  const targets = (data ?? []).filter((p) => isTargetListing(p.title));
  console.log(`Scanned ${(data ?? []).length} properties`);
  console.log(`Matched ${targets.length} sample listings to DELETE:`);
  for (const p of targets) {
    console.log(
      ` - [${p.is_active ? "active" : "inactive"}]${p.is_verified ? " verified" : ""} ${p.id}  ${p.title} (${p.neighborhood})`,
    );
  }

  if (dryRun || targets.length === 0) {
    console.log(dryRun ? "Dry run — no changes." : "Nothing to delete.");
    return;
  }

  const ids = targets.map((p) => p.id);
  console.log("Cleaning related rows…");
  await deleteRelated(admin, ids);

  const { error: deleteError } = await admin.from("properties").delete().in("id", ids);
  if (deleteError) throw deleteError;
  console.log(`✓ Permanently deleted ${ids.length} listings.`);
}

try {
  await main();
} catch (e) {
  console.error(e.message ?? e);
  process.exit(1);
}
