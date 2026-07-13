/**
 * Seed live Supabase properties from demo listing data.
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env
 *
 * Usage: node scripts/seed-listings.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import {
  isBrokenListingImageUrl,
  listingPlaceholderUrl,
  normalizePropertyImages,
} from "./listing-placeholders.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const env = {};
  try {
    const text = readFileSync(join(root, ".env"), "utf8");
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      env[key] = val;
    }
  } catch {
    /* optional */
  }
  for (const [k, v] of Object.entries(process.env)) {
    if (v && !env[k]) env[k] = v;
  }
  return env;
}

const IMG = (seed) => listingPlaceholderUrl(seed);

const now = new Date().toISOString();

/** Sample listings — new UUIDs on each seed run are avoided via upsert on title+neighborhood. */
const LISTINGS = [
  {
    title: "Bright 2BR near Yaya Centre",
    property_type: "two_bedroom",
    neighborhood: "Kilimani",
    address: "Argwings Kodhek Rd",
    latitude: -1.2924,
    longitude: 36.7821,
    rent_kes: 42000,
    deposit_kes: 84000,
    bedrooms: 2,
    bathrooms: 2,
    area_sqm: 85,
    description: "Spacious 2-bedroom with borehole backup and 24/7 security. Fibre-ready building.",
    amenities: ["Parking", "Borehole", "Fibre", "Balcony"],
    images: [IMG(1), IMG(2)],
    is_verified: true,
    authenticity_score: 88,
    health_score: 82,
  },
  {
    title: "Modern studio — Westlands Square",
    property_type: "studio",
    neighborhood: "Westlands",
    address: "Ring Rd Parklands",
    latitude: -1.2678,
    longitude: 36.8075,
    rent_kes: 32000,
    deposit_kes: 64000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 42,
    description: "Compact studio ideal for young professionals. Zuku fibre installed.",
    amenities: ["Fibre", "Lift", "Security"],
    images: [IMG(3)],
    is_verified: true,
    authenticity_score: 76,
    health_score: 74,
  },
  {
    title: "Affordable bedsitter — Kasarani Mwiki",
    property_type: "bedsitter",
    neighborhood: "Kasarani",
    address: "Mwiki Rd",
    latitude: -1.2245,
    longitude: 36.8998,
    rent_kes: 14000,
    deposit_kes: 28000,
    bedrooms: 0,
    bathrooms: 1,
    area_sqm: 22,
    description: "Clean bedsitter near Thika Road. Shared water tank.",
    amenities: ["Water tank", "Security"],
    images: [IMG(4)],
    is_verified: false,
    authenticity_score: 65,
    health_score: 60,
  },
  {
    title: "3BR family home — Lavington",
    property_type: "three_bedroom",
    neighborhood: "Lavington",
    address: "James Gichuru Rd",
    latitude: -1.2798,
    longitude: 36.7689,
    rent_kes: 95000,
    deposit_kes: 190000,
    bedrooms: 3,
    bathrooms: 3,
    area_sqm: 145,
    description: "Quiet compound with parking and garden. DSTV-ready.",
    amenities: ["Parking", "Garden", "Security", "Borehole"],
    images: [IMG(5), IMG(6)],
    is_verified: true,
    authenticity_score: 92,
    health_score: 88,
  },
];

const DEMO_LANDLORD_EMAIL = "demo-landlord@nyumbasearch.app";
const DEMO_LANDLORD_PASSWORD = `NyumbaDemo-${randomUUID().slice(0, 8)}!`;

function listingKey(title, neighborhood) {
  return `${title}::${neighborhood}`;
}

async function resolveDemoLandlordId(admin) {
  const { data: existingUsers } = await admin.auth.admin.listUsers({ perPage: 200 });
  const existingId = existingUsers?.users?.find((u) => u.email === DEMO_LANDLORD_EMAIL)?.id;
  if (existingId) {
    console.log("Using existing demo landlord:", DEMO_LANDLORD_EMAIL);
    return existingId;
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: DEMO_LANDLORD_EMAIL,
    password: DEMO_LANDLORD_PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: "NyumbaSearch Demo Landlord" },
  });
  if (createErr) {
    console.error("Could not create demo landlord:", createErr.message);
    process.exit(1);
  }
  console.log("Created demo landlord user:", DEMO_LANDLORD_EMAIL);
  return created.user.id;
}

async function ensureLandlordProfile(admin, landlordId) {
  await admin.from("profiles").upsert({
    id: landlordId,
    full_name: "NyumbaSearch Demo Landlord",
    phone: "+254700000001",
    is_portal_active: true,
    active_portal: "landlord",
  });

  const { data: existingRole } = await admin
    .from("user_roles")
    .select("id")
    .eq("user_id", landlordId)
    .eq("role", "landlord")
    .maybeSingle();

  if (existingRole) return;

  const { error: roleErr } = await admin
    .from("user_roles")
    .insert({ user_id: landlordId, role: "landlord" });
  if (roleErr) console.warn("Role insert:", roleErr.message);
}

async function deactivateExtraDemoListings(admin, landlordId, keepKeys) {
  const { data: activeDemoProps } = await admin
    .from("properties")
    .select("id, title, neighborhood")
    .eq("owner_id", landlordId)
    .eq("is_active", true);

  let deactivated = 0;
  for (const prop of activeDemoProps ?? []) {
    if (keepKeys.has(listingKey(prop.title, prop.neighborhood))) continue;
    const { error: deactivateErr } = await admin
      .from("properties")
      .update({ is_active: false })
      .eq("id", prop.id);
    if (deactivateErr) {
      console.warn(`Deactivate "${prop.title}":`, deactivateErr.message);
    } else {
      deactivated++;
    }
  }
  return deactivated;
}

async function fixBrokenListingImages(admin) {
  const { data: activeProps } = await admin
    .from("properties")
    .select("id, title, images")
    .eq("is_active", true);

  let imagesFixed = 0;
  for (const row of activeProps ?? []) {
    const needsFix = (row.images ?? []).some((url) => isBrokenListingImageUrl(url));
    if (!needsFix) continue;
    const images = normalizePropertyImages(row.images, row.id);
    const { error: fixErr } = await admin.from("properties").update({ images }).eq("id", row.id);
    if (fixErr) console.warn(`Image fix "${row.title}":`, fixErr.message);
    else imagesFixed++;
  }
  return imagesFixed;
}

async function insertMissingListings(admin, landlordId, existingKeys) {
  let inserted = 0;
  let skipped = 0;

  for (const listing of LISTINGS) {
    const key = listingKey(listing.title, listing.neighborhood);
    if (existingKeys.has(key)) {
      skipped++;
      continue;
    }

    const row = {
      id: randomUUID(),
      owner_id: landlordId,
      title: listing.title,
      property_type: listing.property_type,
      neighborhood: listing.neighborhood,
      address: listing.address,
      latitude: listing.latitude,
      longitude: listing.longitude,
      rent_kes: listing.rent_kes,
      deposit_kes: listing.deposit_kes,
      bedrooms: listing.bedrooms,
      bathrooms: listing.bathrooms,
      area_sqm: listing.area_sqm,
      description: listing.description,
      amenities: listing.amenities,
      images: listing.images,
      video_url: null,
      tour_url: null,
      is_verified: listing.is_verified,
      is_active: true,
      is_vacant: true,
      authenticity_score: listing.authenticity_score,
      health_score: listing.health_score ?? 70,
      available_from: now,
      views: 0,
    };

    const { error } = await admin.from("properties").insert(row);
    if (error) {
      console.error(`Failed "${listing.title}":`, error.message);
    } else {
      inserted++;
      existingKeys.add(key);
    }
  }

  return { inserted, skipped };
}

async function assignOrphanListings(admin, landlordId) {
  const { count: orphanCount } = await admin
    .from("properties")
    .update({ owner_id: landlordId })
    .eq("is_active", true)
    .is("owner_id", null)
    .select("id", { count: "exact", head: true });

  if (orphanCount) {
    console.log(`Assigned ${orphanCount} orphan listing(s) to demo landlord.`);
  }
}

async function main() {
  const env = loadEnv();
  const url = env.SUPABASE_URL ?? env.VITE_SUPABASE_URL;
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
    process.exit(1);
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const landlordId = await resolveDemoLandlordId(admin);
  await ensureLandlordProfile(admin, landlordId);

  const { data: existingProps } = await admin
    .from("properties")
    .select("id, title, neighborhood, images")
    .eq("owner_id", landlordId);

  const existingKeys = new Set(
    (existingProps ?? []).map((p) => listingKey(p.title, p.neighborhood)),
  );
  const keepKeys = new Set(
    LISTINGS.map((listing) => listingKey(listing.title, listing.neighborhood)),
  );

  const deactivated = await deactivateExtraDemoListings(admin, landlordId, keepKeys);
  const imagesFixed = await fixBrokenListingImages(admin);
  const { inserted, skipped } = await insertMissingListings(admin, landlordId, existingKeys);

  const { count } = await admin
    .from("properties")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true);

  await assignOrphanListings(admin, landlordId);

  console.log(
    `Done. Inserted ${inserted}, skipped ${skipped} (already seeded), deactivated ${deactivated} extra demo listing(s), fixed ${imagesFixed} broken image set(s).`,
  );
  console.log(`Active listings in DB: ${count ?? "?"}`);
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exit(1);
}
